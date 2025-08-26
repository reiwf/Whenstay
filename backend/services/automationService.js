const { supabaseAdmin } = require('../config/supabase');
const communicationService = require('./communicationService');

class AutomationService {
  constructor() {
    this.supabase = supabaseAdmin;
  }

  // ===== AUTOMATION RULE EVALUATION =====

  /**
   * Process a reservation for automation rules
   * Called when reservation is created or updated
   */
  async processReservationAutomation(reservation, isUpdate = false) {
    try {
      console.log(`Processing automation for reservation ${reservation.id} (${reservation.beds24BookingId})`);

      // Cancel existing scheduled messages if this is an update
      if (isUpdate) {
        await this.cancelScheduledMessagesForReservation(reservation.id);
      }

      // Get enabled automation rules for this property (handle both field formats)
      const propertyId = reservation.property_id || reservation.propertyId;
      const rules = await this.getEnabledAutomationRules(propertyId);
      console.log(`Found ${rules.length} enabled automation rules`);

      const scheduledCount = { success: 0, failed: 0 };

      // Process each automation rule
      for (const rule of rules) {
        try {
          await this.evaluateAndScheduleRule(reservation, rule);
          scheduledCount.success++;
        } catch (error) {
          console.error(`Error processing rule ${rule.id} (${rule.name}):`, error);
          scheduledCount.failed++;
        }
      }

      console.log(`Automation processing complete for reservation ${reservation.id}:`, {
        rulesProcessed: rules.length,
        scheduled: scheduledCount.success,
        failed: scheduledCount.failed
      });

      return scheduledCount;
    } catch (error) {
      console.error('Error in processReservationAutomation:', error);
      throw error;
    }
  }

  /**
   * Get enabled automation rules for a property (or global rules)
   * Only returns rules where both the rule AND the template are enabled
   */
  async getEnabledAutomationRules(propertyId) {
    let query = this.supabase
      .from('automation_rules')
      .select(`
        *,
        message_templates(*)
      `)
      .eq('enabled', true)
      .eq('message_templates.enabled', true)  // Filter by template enabled status
      .order('created_at');

    // Handle property filtering properly
    if (propertyId && propertyId !== null) {
      query = query.or(`property_id.is.null,property_id.eq.${propertyId}`);
    } else {
      query = query.is('property_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching automation rules:', error);
      throw error;
    }

    // Filter out rules where template is disabled (extra safety check)
    const enabledRules = (data || []).filter(rule => {
      if (!rule.message_templates) {
        console.warn(`Rule ${rule.name} has no associated template, skipping`);
        return false;
      }
      if (rule.message_templates.enabled === false) {
        console.log(`Skipping rule ${rule.name} - template is disabled`);
        return false;
      }
      return true;
    });

    console.log(`Found ${enabledRules.length} enabled automation rules (with enabled templates)`);
    return enabledRules;
  }

  /**
   * Evaluate a single automation rule and schedule message if applicable
   */
  async evaluateAndScheduleRule(reservation, rule) {
    try {
      console.log(`Evaluating rule ${rule.name} for reservation ${reservation.id}`);

      // Check if rule filters match this reservation
      if (!this.doesReservationMatchRule(reservation, rule)) {
        console.log(`Rule ${rule.name} filters don't match reservation, skipping`);
        return;
      }

      // Calculate run_at time based on rule offset
      let runAt = await this.calculateRunTime(reservation, rule);
      if (!runAt) {
        console.log(`Unable to calculate run time for rule ${rule.name}, skipping`);
        return;
      }

      // Skip if the scheduled time is in the past (more than 5 minutes ago)
      // BUT: For backfill scenarios, we need smarter logic
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      if (runAt < fiveMinutesAgo) {
        // For backfill: Send with proper ordering if it's a valuable message
        if (this.shouldBackfillMessage(reservation, rule, runAt, now)) {
          const orderDelayMinutes = this.getBackfillOrderDelay(rule);
          const newRunAt = new Date(now.getTime() + orderDelayMinutes * 60000);
          console.log(`BACKFILL: Rule ${rule.name} scheduled time is past, but scheduling for backfill:`, {
            originalRunAt: runAt.toISOString(),
            newRunAt: newRunAt.toISOString(),
            delayMinutes: orderDelayMinutes,
            checkInDate: reservation.check_in_date || reservation.checkInDate
          });
          // Maintain proper order by scheduling based on rule priority
          runAt = newRunAt;
        } else {
          console.log(`Rule ${rule.name} scheduled time is in the past (${runAt.toISOString()}), skipping backfill`);
          return;
        }
      }

      // Determine channel (always inapp for scheduled messages)
      const channel = this.determineChannel(reservation, rule);

      // Find or create thread for this reservation (always use inapp for scheduled messages)
      const externalThreadId = reservation.beds24_booking_id || reservation.beds24BookingId || reservation.id;
      const thread = await communicationService.findOrCreateThreadByReservation(
        reservation.id,
        {
          channels: [{ channel: 'inapp', external_thread_id: externalThreadId }]
        }
      );

      // Build template variables
      const variables = await this.buildTemplateVariables(reservation);

      // Check if a scheduled message already exists for this combination
      // First check by exact run_at time
      let { data: existingMessage } = await this.supabase
        .from('scheduled_messages')
        .select('id, status')
        .eq('thread_id', thread.id)
        .eq('template_id', rule.template_id)
        .eq('run_at', runAt.toISOString())
        .single();

      // If no exact match found, check for any existing message with same template and thread
      // This prevents duplicates when backfill changes timing
      if (!existingMessage) {
        const { data: anyExisting } = await this.supabase
          .from('scheduled_messages')
          .select('id, status, run_at')
          .eq('thread_id', thread.id)
          .eq('template_id', rule.template_id)
          .in('status', ['queued', 'sent'])
          .limit(1)
          .single();

        if (anyExisting) {
          console.log(`Found existing message for rule ${rule.name} with different timing, skipping duplicate`);
          return anyExisting.id;
        }
      }

      let scheduledMessage;
      
      if (existingMessage) {
        if (existingMessage.status === 'canceled') {
          // Reactivate canceled message
          const { data: reactivated, error: reactivateError } = await this.supabase
            .from('scheduled_messages')
            .update({ 
              status: 'queued',
              cancellation_reason: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMessage.id)
            .select('id')
            .single();
          
          if (reactivateError) {
            console.error(`Error reactivating canceled message for rule ${rule.name}:`, reactivateError);
            throw reactivateError;
          }
          
          scheduledMessage = reactivated.id;
          console.log(`Reactivated existing canceled message for rule ${rule.name}`);
        } else {
          // Message already exists and is active
          scheduledMessage = existingMessage.id;
          console.log(`Message already scheduled for rule ${rule.name}, skipping duplicate`);
        }
      } else {
        // Schedule new message using the database function
        const { data: newMessage, error } = await this.supabase
          .rpc('schedule_message', {
            p_thread_id: thread.id,
            p_template_id: rule.template_id,
            p_channel: channel,
            p_run_at: runAt.toISOString(),
            p_payload: variables
          });

        if (error) {
          // Check if it's a duplicate key error (race condition)
          if (error.code === '23505' && error.message.includes('unique_thread_template_runtime')) {
            console.log(`Duplicate message detected for rule ${rule.name} (race condition), treating as success`);
            // Find the existing message that was created
            const { data: raceMessage } = await this.supabase
              .from('scheduled_messages')
              .select('id')
              .eq('thread_id', thread.id)
              .eq('template_id', rule.template_id)
              .eq('run_at', runAt.toISOString())
              .single();
            scheduledMessage = raceMessage?.id || 'duplicate';
          } else {
            console.error(`Error scheduling message for rule ${rule.name}:`, error);
            throw error;
          }
        } else {
          scheduledMessage = newMessage;
        }
      }

      // Also store the rule and reservation IDs for tracking
      const { error: updateError } = await this.supabase
        .from('scheduled_messages')
        .update({
          rule_id: rule.id,
          reservation_id: reservation.id
        })
        .eq('id', scheduledMessage);

      if (updateError) {
        console.error('Error updating scheduled message with rule/reservation IDs:', updateError);
        // Non-fatal error, continue
      }

      console.log(`Successfully scheduled message for rule ${rule.name}:`, {
        scheduledMessageId: scheduledMessage,
        runAt: runAt.toISOString(),
        channel,
        threadId: thread.id
      });

      return scheduledMessage;
    } catch (error) {
      console.error(`Error in evaluateAndScheduleRule for rule ${rule.name}:`, error);
      throw error;
    }
  }

  /**
   * Check if reservation matches rule filters
   */
  doesReservationMatchRule(reservation, rule) {
    // If no filters, rule applies to all reservations
    if (!rule.filters) return true;

    try {
      const filters = typeof rule.filters === 'string' ? JSON.parse(rule.filters) : rule.filters;
      
      // Example filters:
      // { "booking_source": ["airbnb"], "min_nights": 2, "property_types": ["apartment"] }
      
      // Check booking source filter
      if (filters.booking_source && filters.booking_source.length > 0) {
        const reservationSource = (reservation.booking_source || reservation.bookingSource || '').toLowerCase();
        const matchesSource = filters.booking_source.some(source => 
          reservationSource.includes(source.toLowerCase())
        );
        if (!matchesSource) return false;
      }

      // Check minimum nights filter
      if (filters.min_nights) {
        const checkInDate = reservation.check_in_date || reservation.checkInDate;
        const checkOutDate = reservation.check_out_date || reservation.checkOutDate;
        
        if (checkInDate && checkOutDate) {
          const checkIn = new Date(checkInDate);
          const checkOut = new Date(checkOutDate);
          const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
          if (nights < filters.min_nights) return false;
        }
      }

      // Check guest count filter
      const numGuests = reservation.num_guests || reservation.numGuests || 1;
      if (filters.min_guests && numGuests < filters.min_guests) return false;
      if (filters.max_guests && numGuests > filters.max_guests) return false;

      // Add more filter types as needed

      return true;
    } catch (error) {
      console.error('Error evaluating rule filters:', error);
      return true; // Default to allowing if filter evaluation fails
    }
  }

  /**
   * Calculate when to run the scheduled message based on rule offset
   */
  async calculateRunTime(reservation, rule) {
    try {
      // Parse offset configuration
      const offset = typeof rule.offset_json === 'string' ? JSON.parse(rule.offset_json) : rule.offset_json;
      if (!offset) {
        console.error('No offset configuration found for rule:', rule.name);
        return null;
      }

      // Get property timezone (default to Asia/Tokyo if not found)
      const propertyId = reservation.property_id || reservation.propertyId;
      const propertyTimezone = await this.getPropertyTimezone(propertyId);

      let baseDateTime;

      // Determine base time based on event type
      switch (rule.event) {
        case 'booking_created':
          // X minutes after booking creation
          baseDateTime = new Date(reservation.created_at || reservation.createdAt || new Date());
          break;
          
        case 'check_in':
          // Relative to check-in date/time
          const checkInDate = reservation.check_in_date || reservation.checkInDate;
          if (!checkInDate) {
            console.error('No check-in date found for reservation:', reservation.id);
            return null;
          }
          baseDateTime = new Date(checkInDate);
          // If check-in time is specified, use it; otherwise default to 3 PM
          const checkInTime = reservation.check_in_time || reservation.checkInTime;
          if (checkInTime) {
            const [hours, minutes] = checkInTime.split(':');
            baseDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            baseDateTime.setHours(16, 0, 0, 0); // Default 3 PM check-in
          }
          break;
          
        case 'check_out':
          // Relative to check-out date/time
          const checkOutDate = reservation.check_out_date || reservation.checkOutDate;
          if (!checkOutDate) {
            console.error('No check-out date found for reservation:', reservation.id);
            return null;
          }
          baseDateTime = new Date(checkOutDate);
          // If check-out time is specified, use it; otherwise default to 11 AM
          const checkOutTime = reservation.check_out_time || reservation.checkOutTime;
          if (checkOutTime) {
            const [hours, minutes] = checkOutTime.split(':');
            baseDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            baseDateTime.setHours(10, 0, 0, 0); // Default 11 AM check-out
          }
          break;
          
        default:
          console.error(`Unknown event type: ${rule.event}`);
          return null;
      }

      // Validate the calculated base date
      if (isNaN(baseDateTime.getTime())) {
        console.error('Invalid base date time calculated:', baseDateTime, 'for reservation:', reservation.id);
        return null;
      }

      // Apply offset
      let runAt = new Date(baseDateTime);

      // Apply time offset (before/after)
      if (offset.days) {
        runAt.setDate(runAt.getDate() + (offset.direction === 'after' ? offset.days : -offset.days));
      }
      
      if (offset.hours) {
        runAt.setHours(runAt.getHours() + (offset.direction === 'after' ? offset.hours : -offset.hours));
      }
      
      if (offset.minutes) {
        runAt.setMinutes(runAt.getMinutes() + (offset.direction === 'after' ? offset.minutes : -offset.minutes));
      }

      // Convert to property timezone if needed
      // Note: For now using simple calculation, can be enhanced with proper timezone library
      console.log(`Calculated run time for rule ${rule.name}:`, {
        baseDateTime: baseDateTime.toISOString(),
        runAt: runAt.toISOString(),
        propertyTimezone,
        offset
      });

      return runAt;
    } catch (error) {
      console.error('Error calculating run time:', error);
      return null;
    }
  }

  /**
   * Get backfill order delay in minutes to maintain proper message order
   */
  getBackfillOrderDelay(rule) {
    // Define specific delays for different message types
    const messageDelays = {
      'New Reservation Confirmation': 1,        // 1 minute delay
      'Pre-Check-in Reminder - 7 Days': 2,     // 2 minutes delay (shouldn't trigger in backfill anyway)
      'Pre-Check-in Reminder - 3 Days': 3,     // 3 minutes delay (shouldn't trigger in backfill anyway)
      'Final Pre-Check-in Reminder - 1 Day': 4, // 4 minutes delay
      'Check-in Instructions': 10,              // 10 minutes delay (as requested)
      'Mid-Stay Check-in': 0,                   // No delay - future message
      'Pre-Check-out Reminder': 0,              // No delay - future message
      'Post-Stay Follow-up': 0                  // No delay - future message
    };

    // Get specific delay for this rule (default to 1 minute if not found)
    const delay = messageDelays[rule.name] || 1;
    
    console.log(`Backfill delay for ${rule.name}: ${delay} minutes`);
    return delay;
  }

  /**
   * Determine if a past scheduled message should be backfilled (sent immediately)
   */
  shouldBackfillMessage(reservation, rule, originalRunAt, now) {
    const checkInDate = reservation.check_in_date || reservation.checkInDate;
    const checkOutDate = reservation.check_out_date || reservation.checkOutDate;
    
    if (!checkInDate || !checkOutDate) return false;
    
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    switch (rule.event) {
      case 'booking_created':
        // Always send confirmation messages regardless of timing
        if (rule.name?.includes('Confirmation')) {
          return true; // Confirmation messages should never be skipped
        }
        // Send welcome messages only if guest hasn't checked in yet
        if (rule.name?.includes('Welcome')) {
          return checkIn > now; // Only if guest hasn't checked in yet
        }
        return false;
        
      case 'check_in':
        if (rule.name?.includes('Instructions')) {
          // Send check-in instructions if check-in is today or in the future
          // Use proper timezone-aware date comparison
          const todayInTokyo = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
          const checkInDateOnly = checkInDate.split('T')[0]; // Get YYYY-MM-DD part only
          
          console.log(`Check-in instructions backfill check:`, {
            checkInDateOnly,
            todayInTokyo,
            shouldBackfill: checkInDateOnly >= todayInTokyo
          });
          
          // Send if check-in date is today or in the future
          return checkInDateOnly >= todayInTokyo;
        }
        
        if (rule.name?.includes('Reminder')) {
          // Skip 7-day and 3-day pre-check-in reminders during backfill
          if (rule.name?.includes('7 Days') || rule.name?.includes('3 Days')) {
            return false; // These reminders don't need backfill
          }
          // Send other pre-check-in reminders only if check-in is still in the future
          return checkIn > now;
        }
        
        if (rule.name?.includes('Mid-Stay')) {
          // Send mid-stay messages if guest is currently staying or will stay
          return now >= checkIn && now <= checkOut;
        }
        
        return false;
        
      case 'check_out':
        if (rule.name?.includes('Pre-Check-out')) {
          // Send pre-check-out if check-out is in the future
          return checkOut > now;
        }
        
        if (rule.name?.includes('Follow-up')) {
          // Only send follow-up if check-out was recent (within 7 days)
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return checkOut > oneWeekAgo;
        }
        
        return false;
        
      default:
        return false;
    }
  }

  /**
   * Get property timezone (with fallback)
   */
  async getPropertyTimezone(propertyId) {
    try {
      if (!propertyId) return 'Asia/Tokyo';

      const { data: property } = await this.supabase
        .from('properties')
        .select('timezone')
        .eq('id', propertyId)
        .single();

      return property?.timezone || 'Asia/Tokyo';
    } catch (error) {
      console.error('Error getting property timezone:', error);
      return 'Asia/Tokyo';
    }
  }

  /**
   * Determine channel for scheduled messages
   * Always uses inapp channel for consistent delivery
   */
  determineChannel(reservation, rule) {
    // Override: Always use inapp channel for all scheduled messages
    // This ensures consistent delivery through the in-app system regardless of rule configuration
    return 'inapp';
  }

  /**
   * Build template variables from reservation data
   */
  async buildTemplateVariables(reservation) {
    try {
      // Get property information (handle both field formats)
      let property = null;
      const propertyId = reservation.property_id || reservation.propertyId;
      if (propertyId) {
        const { data } = await this.supabase
          .from('properties')
          .select('name, address, description')
          .eq('id', propertyId)
          .single();
        property = data;
      }

      // Format dates using Asia/Tokyo timezone
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'Asia/Tokyo'
        });
      };

      const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Tokyo'
        });
      };

      // Get dates from reservation (handle both snake_case and camelCase)
      const checkInDate = reservation.check_in_date || reservation.checkInDate;
      const checkOutDate = reservation.check_out_date || reservation.checkOutDate;
      const checkInTime = reservation.check_in_time || reservation.checkInTime;
      const checkOutTime = reservation.check_out_time || reservation.checkOutTime;

      // Build variables object
      const variables = {
        // Guest information (handle both field naming conventions)
        // Note: booking_name is now auto-generated by database trigger from booking_firstname + booking_lastname
        guest_name: reservation.booking_name || 'Guest', // Use the trigger-generated full name
        guest_first_name: reservation.booking_firstname || reservation.bookingFirstname || 'Guest',
        guest_last_name: reservation.booking_lastname || reservation.bookingLastname || '',
        guest_email: reservation.booking_email || reservation.bookingEmail || '',
        guest_phone: reservation.booking_phone || reservation.bookingPhone || '',
        
        // Dates and times
        check_in_date: formatDate(checkInDate),
        check_out_date: formatDate(checkOutDate),
        check_in_date_short: checkInDate ? new Date(checkInDate).toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' }) : '',
        check_out_date_short: checkOutDate ? new Date(checkOutDate).toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' }) : '',
        check_in_time: formatTime(checkInTime) || '4:00 PM',
        check_out_time: formatTime(checkOutTime) || '10:00 AM',
        
        // Stay details
        num_guests: reservation.num_guests || reservation.numGuests || 1,
        num_adults: reservation.num_adults || reservation.numAdults || 1,
        num_children: reservation.num_children || reservation.numChildren || 0,
        num_nights: checkInDate && checkOutDate ? Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)) : 0,
        
        // Property information
        property_name: property?.name || 'Your accommodation',
        property_address: property?.address || '',
        property_description: property?.description || '',
        
        // Booking information
        booking_source: reservation.booking_source || reservation.bookingSource || '',
        total_amount: reservation.total_amount || reservation.totalAmount || 0,
        currency: reservation.currency || 'JPY',
        booking_reference: reservation.beds24_booking_id || reservation.beds24BookingId || reservation.id,
        
        // Room information
        room_number: reservation.room_number || reservation.roomNumber || '',
        
        // Special requests
        special_requests: reservation.special_requests || reservation.specialRequests || '',
        comments: reservation.comments || '',
        
        // Dates for calculations
        _check_in_raw: checkInDate,
        _check_out_raw: checkOutDate,
        _today: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }) // YYYY-MM-DD format in Asia/Tokyo timezone
      };

      return variables;
    } catch (error) {
      console.error('Error building template variables:', error);
      return {};
    }
  }

  // ===== CANCELLATION & RESCHEDULING =====

  /**
   * Cancel scheduled messages for a reservation
   */
  async cancelScheduledMessagesForReservation(reservationId, reason = 'Reservation updated') {
    try {
      const { data, error } = await this.supabase
        .from('scheduled_messages')
        .update({
          status: 'canceled',
          cancellation_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('reservation_id', reservationId)
        .eq('status', 'queued')
        .select();

      if (error) {
        console.error('Error canceling scheduled messages:', error);
        throw error;
      }

      console.log(`Canceled ${data?.length || 0} scheduled messages for reservation ${reservationId}`);
      return data?.length || 0;
    } catch (error) {
      console.error('Error in cancelScheduledMessagesForReservation:', error);
      throw error;
    }
  }

  /**
   * Handle reservation cancellation
   */
  async handleReservationCancellation(reservationId) {
    return await this.cancelScheduledMessagesForReservation(reservationId, 'Reservation canceled');
  }

  // ===== BACKFILL LOGIC =====

  /**
   * Process existing reservations that might need automation
   */
  async backfillExistingReservations(options = {}) {
    try {
      const { 
        limit = 100, 
        daysAhead = 30,
        onlyFutureCheckIns = true 
      } = options;

      console.log('Starting backfill of existing reservations...');

      // Get reservations that might need scheduling
      let query = this.supabase
        .from('reservations')
        .select('*')
        .eq('status', 'confirmed')
        .order('check_in_date')
        .limit(limit);

      if (onlyFutureCheckIns) {
        // Get today's date in Asia/Tokyo timezone
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }); // en-CA gives YYYY-MM-DD format
        query = query.gte('check_in_date', today);
      }

      if (daysAhead) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        query = query.lte('check_in_date', futureDate.toISOString().split('T')[0]);
      }

      const { data: reservations, error } = await query;
      if (error) throw error;

      console.log(`Found ${reservations?.length || 0} reservations to process for backfill`);

      const results = { processed: 0, skipped: 0, failed: 0 };

      for (const reservation of reservations || []) {
        try {
          // Check if this reservation already has scheduled messages
          const { data: existing } = await this.supabase
            .from('scheduled_messages')
            .select('id')
            .eq('reservation_id', reservation.id)
            .eq('status', 'queued')
            .limit(1)
            .single();

          if (existing) {
            console.log(`Reservation ${reservation.id} already has scheduled messages, skipping`);
            results.skipped++;
            continue;
          }

          // Process automation for this reservation
          await this.processReservationAutomation(reservation, false);
          results.processed++;
          
          console.log(`Processed backfill automation for reservation ${reservation.id} (${results.processed}/${reservations.length})`);
          
        } catch (error) {
          console.error(`Error processing reservation ${reservation.id} for backfill:`, error);
          results.failed++;
        }
      }

      console.log('Backfill complete:', results);
      return results;
    } catch (error) {
      console.error('Error in backfillExistingReservations:', error);
      throw error;
    }
  }
}

module.exports = new AutomationService();
