const { DateTime } = require('luxon');

class ScheduledMessageGeneratorService {
  constructor() {
    this.supabase = null;
    this.communicationService = null;
  }

  // Initialize with dependencies
  init(supabase, communicationService) {
    this.supabase = supabase;
    this.communicationService = communicationService;
  }

  // Check if messages should be sent in current environment
  shouldSendInCurrentEnvironment() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const enableScheduledMessages = process.env.ENABLE_SCHEDULED_MESSAGES === 'true';
    
    // In production or when explicitly enabled in development
    return !isDevelopment || enableScheduledMessages;
  }

  // Generate idempotency key for preventing duplicates
  generateIdempotencyKey(ruleId, reservationId, scheduledAt) {
    const utcTimestamp = DateTime.fromJSDate(scheduledAt).toUTC().toISO();
    return `${ruleId}:${reservationId}:${utcTimestamp}`;
  }

  // Combine date with time in specific timezone
  combineDateTime(dateISO, timeStr, timezone) {
    const [hour, minute] = (timeStr || '10:00').split(':').map(Number);
    return DateTime.fromISO(dateISO, { zone: timezone })
      .set({ hour, minute, second: 0, millisecond: 0 });
  }

  // Calculate when a message should be sent based on rule and reservation
  computeScheduledAt(rule, reservation) {
    const tz = rule.timezone || 'Asia/Tokyo';
    
    // Parse reservation dates with times
    const checkInTime = reservation.check_in_time || '15:00';
    const checkOutTime = reservation.check_out_time || '11:00';
    
    const checkIn = DateTime.fromISO(`${reservation.check_in_date}T${checkInTime}`, { zone: tz });
    const checkOut = DateTime.fromISO(`${reservation.check_out_date}T${checkOutTime}`, { zone: tz });
    const created = DateTime.fromISO(reservation.created_at, { zone: tz });

    switch (rule.type) {
      case 'ON_CREATE_DELAY_MIN':
        return created.plus({ minutes: rule.delay_minutes || 0 });

      case 'BEFORE_ARRIVAL_DAYS_AT_TIME': {
        const targetDate = checkIn.minus({ days: rule.days || 0 });
        return this.combineDateTime(targetDate.toISODate(), rule.at_time, tz);
      }

      case 'ARRIVAL_DAY_HOURS_BEFORE_CHECKIN':
        return checkIn.minus({ hours: rule.hours || 0 });

      case 'AFTER_CHECKIN_HOURS':
        return checkIn.plus({ hours: rule.hours || 0 });

      case 'BEFORE_CHECKOUT_HOURS':
        return checkOut.minus({ hours: rule.hours || 0 });

      case 'AFTER_DEPARTURE_DAYS':
        return checkOut.plus({ days: rule.days || 0 })
          .set({ hour: 10, minute: 0 }); // default 10:00 AM

      default:
        throw new Error(`Unknown rule type: ${rule.type}`);
    }
  }

  // Determine if a message should be created now based on backfill policy and context
  shouldCreateMessage(rule, scheduledAt, reservation, now = null, isRealtimeGeneration = false) {
    const currentTime = now || DateTime.now().setZone(rule.timezone || 'Asia/Tokyo');
    
    // REAL-TIME GENERATION: Skip time window restrictions for immediate generation
    if (!isRealtimeGeneration) {
      // OPTIMIZATION: For cron-based generation, only create Rules B-H if scheduled_at is within 7 days
      // Rule A should be scheduled immediately regardless of timing
      if (rule.code !== 'A') {
        const sevenDaysOut = currentTime.plus({ days: 7 });
        if (scheduledAt > sevenDaysOut) {
          return false; // Don't pre-materialize messages beyond 7 days for cron processing
        }
      }
    }
    
    switch (rule.backfill) {
      case 'none':
        // Only create if scheduled time is in the future
        return scheduledAt > currentTime;
        
      case 'skip_if_past':
        // Create only if future; otherwise will be marked as skipped
        return scheduledAt > currentTime;
        
      case 'until_checkin': {
        const tz = rule.timezone || 'Asia/Tokyo';
        const checkInTime = reservation.check_in_time || '15:00';
        const checkIn = DateTime.fromISO(`${reservation.check_in_date}T${checkInTime}`, { zone: tz });
        
        // Allow backfill if we already passed scheduledAt but haven't reached check-in
        if (scheduledAt <= currentTime && currentTime < checkIn) {
          return true; // enqueue to send ASAP
        }
        return scheduledAt > currentTime; // or it's still in the future
      }
      
      default:
        return false;
    }
  }

  // Build payload with reservation variables for template substitution
  buildPayload(reservation) {
    return {
      guestName: reservation.booking_name || 'Guest',
      checkInDate: reservation.check_in_date,
      checkInTime: reservation.check_in_time || '15:00',
      checkOutDate: reservation.check_out_date,
      checkOutTime: reservation.check_out_time || '11:00',
      propertyName: reservation.property_name || reservation.properties?.name || 'Property',
      room: reservation.room_unit_label || reservation.room_units?.unit_number || 'Your room',
      wifiName: reservation.wifi_name || reservation.properties?.wifi_name || 'WiFi',
      wifiPassword: reservation.wifi_password || reservation.properties?.wifi_password || 'Ask at front desk'
    };
  }

  // Generate scheduled messages for a single reservation based on all enabled rules
  async generateForReservation(reservation, rules = null, isRealtimeGeneration = false) {
    try {
      if (isRealtimeGeneration) {
        console.log(`🚀 Real-time message generation for reservation ${reservation.id} (${reservation.booking_name})`);
      }

      // Get rules if not provided
      if (!rules) {
        rules = await this.getEnabledRules(reservation.property_id);
      }

      const results = [];
      const currentTime = DateTime.now().setZone('Asia/Tokyo');

      for (const rule of rules.filter(r => r.enabled)) {
        try {
          // Handle all rules (A-H) as scheduled messages
          const scheduledAt = this.computeScheduledAt(rule, reservation);
          if (!scheduledAt) {
            console.warn(`⚠️ Could not compute scheduled time for rule ${rule.code}`);
            continue;
          }

          const shouldCreate = this.shouldCreateMessage(rule, scheduledAt, reservation, currentTime, isRealtimeGeneration);
          if (!shouldCreate) {
            if (isRealtimeGeneration) {
              console.log(`⏭️ Skipping rule ${rule.code} for real-time generation (backfill policy: ${rule.backfill})`);
            }
            continue;
          }

          const channel = rule.message_templates?.channel;
          if (!channel) {
            console.warn(`⚠️ Rule ${rule.code} has no template channel defined, skipping`);
            continue;
          }

          const idempotencyKey = this.generateIdempotencyKey(rule.id, reservation.id, scheduledAt.toJSDate());
          const payload = this.buildPayload(reservation);

          // Create scheduled message for all rules (A-H)
          const scheduledMessage = await this.communicationService.scheduleMessage({
            thread_id: reservation.thread_id,
            template_id: rule.template_id,
            channel: channel,
            run_at: scheduledAt.toUTC().toISO(),
            payload,
            idempotency_key: idempotencyKey,
            created_by: 'system-scheduler',
            reservation_id: reservation.id,
            rule_id: rule.id
          });

          results.push({
            rule_code: rule.code,
            scheduled_message_id: scheduledMessage.id,
            scheduled_at: scheduledAt.toISO(),
            status: 'created'
          });


        } catch (ruleError) {
          console.error(`❌ Error processing rule ${rule.code}:`, ruleError);
          results.push({
            rule_code: rule.code,
            status: 'error',
            error: ruleError.message
          });
        }
      }

      const immediateCount = results.filter(r => r.status === 'sent_immediate').length;
      const scheduledCount = results.filter(r => r.status === 'created').length;
      
      return results;

    } catch (error) {
      console.error('❌ Error generating messages:', error);
      throw error;
    }
  }

  // Get enabled message rules for a property (or global)
  async getEnabledRules(propertyId = null) {
    const { data: rules, error } = await this.supabase
      .from('message_rules')
      .select(`
        *,
        message_templates(*)
      `)
      .eq('enabled', true)
      .or(propertyId ? `property_id.eq.${propertyId},property_id.is.null` : 'property_id.is.null')
      .order('code');

    if (error) {
      console.error('Error fetching message rules:', error);
      throw error;
    }

    // Validate that all rules have templates with channels
    const rulesWithChannels = (rules || []).filter(rule => {
      if (!rule.message_templates) {
        console.warn(`Rule ${rule.code} has no template associated`);
        return false;
      }
      if (!rule.message_templates.channel) {
        console.warn(`Rule ${rule.code} template has no channel defined`);
        return false;
      }
      return true;
    });

    if (rulesWithChannels.length !== (rules || []).length) {
      console.warn(`Filtered out ${(rules || []).length - rulesWithChannels.length} rules without valid template channels`);
    }

    return rulesWithChannels;
  }

  // Generate messages for recently created reservations (safety net)
  async generateForRecentReservations(minutesBack = 15) {
    try {
      // Log environment status for transparency
      if (!this.shouldSendInCurrentEnvironment()) {
        const environment = process.env.NODE_ENV || 'unknown';
        console.log(`📭 Recent reservations generation running in ${environment} mode - immediate messages will be skipped`);
        console.log(`💡 Set ENABLE_SCHEDULED_MESSAGES=true in .env to enable immediate messages in development`);
      }

      const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
      
      console.log(`🔄 Generating messages for reservations created since ${cutoffTime.toISOString()}`);

      // Get recent reservations with thread information
      const { data: recentReservations, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          properties(name, wifi_name, wifi_password),
          room_units(unit_number),
          message_threads(id)
        `)
        .gte('created_at', cutoffTime.toISOString())
        .not('status', 'eq', 'cancelled');

      if (error) {
        throw error;
      }

      if (!recentReservations || recentReservations.length === 0) {
        console.log('📭 No recent reservations found');
        return { processed: 0, results: [] };
      }

      console.log(`📝 Processing ${recentReservations.length} recent reservations`);

      const allResults = [];
      let skippedCount = 0;
      
      for (const reservation of recentReservations) {
        // OPTIMIZATION: Check if Rule A was already processed for this reservation
        const { data: existingRuleA } = await this.supabase
          .from('scheduled_messages')
          .select('id, status, created_at, message_rules!inner(code)')
          .eq('reservation_id', reservation.id)
          .eq('message_rules.code', 'A')
          .in('status', ['pending', 'sent', 'sent_immediate', 'skipped_dev_mode'])
          .limit(1);

        if (existingRuleA && existingRuleA.length > 0) {
          console.log(`🔄 Skipping reservation ${reservation.id} - Rule A already processed`, {
            reservationId: reservation.id,
            existingStatus: existingRuleA[0].status,
            existingCreatedAt: existingRuleA[0].created_at,
            reason: 'rule_a_already_processed'
          });
          skippedCount++;
          continue; // Skip this reservation
        }

        // Ensure reservation has a thread
        // Handle thread_id - use existing thread if available, otherwise null (will be created during processing)
        if (reservation.message_threads) {
          reservation.thread_id = reservation.message_threads.id;
          console.log(`📝 Using existing thread ${reservation.thread_id} for reservation ${reservation.id}`);
        } else {
          reservation.thread_id = null;
          console.log(`📝 No existing thread for reservation ${reservation.id} - will create during message processing`);
        }

        const results = await this.generateForReservation(reservation);
        allResults.push({
          reservation_id: reservation.id,
          results
        });
      }

      if (skippedCount > 0) {
        console.log(`📊 Cron optimization: Skipped ${skippedCount} reservations that already had Rule A processed`);
      }

      return {
        processed: recentReservations.length,
        results: allResults
      };

    } catch (error) {
      console.error('❌ Error generating for recent reservations:', error);
      throw error;
    }
  }

  // Reconcile scheduled messages for near-term arrivals (DUAL-WINDOW APPROACH)
  async reconcileForFutureArrivals(daysAhead = 10) {
    try {
      // Log environment status for transparency
      if (!this.shouldSendInCurrentEnvironment()) {
        const environment = process.env.NODE_ENV || 'unknown';
        console.log(`📭 Future arrivals reconciliation running in ${environment} mode - immediate messages will be skipped`);
        console.log(`💡 Set ENABLE_SCHEDULED_MESSAGES=true in .env to enable immediate messages in development`);
      }

      const currentTime = DateTime.now().setZone('Asia/Tokyo');
      
      // DUAL-WINDOW OPTIMIZATION: Separate windows for check-in vs check-out based rules
      // Check-in based rules (A-F): Need reservations checking in soon or recently
      const checkinWindowStart = currentTime.minus({ days: 5 }).toISODate();
      const checkinWindowEnd = currentTime.plus({ days: daysAhead }).toISODate();
      
      // Check-out based rules (G-H): Need reservations checking out soon (includes long stays)
      const checkoutWindowStart = currentTime.minus({ days: 2 }).toISODate(); // Account for Rule H (1 day after)
      const checkoutWindowEnd = currentTime.plus({ days: 7 }).toISODate();    // 7-day message window
      
      console.log(`🔧 [DUAL-WINDOW] Reconciling messages:`);
      console.log(`   Check-in rules (A-F): check-ins from ${checkinWindowStart} to ${checkinWindowEnd}`);
      console.log(`   Check-out rules (G-H): check-outs from ${checkoutWindowStart} to ${checkoutWindowEnd}`);

      // Get reservations in EITHER window (fixes checkout message gap)
      const { data: targetReservations, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          properties(name, wifi_name, wifi_password),
          room_units(unit_number),
          message_threads(id)
        `)
        .or(`check_in_date.gte.${checkinWindowStart},check_in_date.lte.${checkinWindowEnd},check_out_date.gte.${checkoutWindowStart},check_out_date.lte.${checkoutWindowEnd}`)
        .not('status', 'eq', 'cancelled');

      if (error) {
        throw error;
      }

      if (!targetReservations || targetReservations.length === 0) {
        console.log('📭 No target reservations found in reconciliation window');
        return { processed: 0, totalGenerated: 0, results: [] };
      }

      console.log(`🎯 Found ${targetReservations.length} reservations in target window (was processing all future reservations)`);

      let totalGenerated = 0;
      const allResults = [];

      for (const reservation of targetReservations) {
        // Handle thread_id - use existing thread if available, otherwise null (will be created during processing)
        if (reservation.message_threads) {
          reservation.thread_id = reservation.message_threads.id;
        } else {
          reservation.thread_id = null;
        }

        // SMART FILTERING: Check if this reservation already has messages for Rules B-H
        const { data: existing } = await this.supabase
          .from('scheduled_messages')
          .select('rule_id, message_rules!inner(code)')
          .eq('reservation_id', reservation.id)
          .in('status', ['pending', 'sent']); // Include sent to avoid regenerating

        const existingRuleCodes = new Set(
          (existing || []).map(s => s.message_rules?.code).filter(Boolean)
        );
        
        // Get rules and filter out ones that already have messages (excluding Rule A)
        const rules = await this.getEnabledRules(reservation.property_id);
        
        // RULE-SPECIFIC FILTERING: Only process rules relevant to this reservation's date windows
        const checkinInWindow = reservation.check_in_date >= checkinWindowStart && 
                               reservation.check_in_date <= checkinWindowEnd;
        const checkoutInWindow = reservation.check_out_date >= checkoutWindowStart && 
                                reservation.check_out_date <= checkoutWindowEnd;
        
        
        const missingRules = rules.filter(rule => {
          // Skip rules that already have messages
          if (existingRuleCodes.has(rule.code)) {
            return false;
          }
          
          // Check-in based rules (A, B, C, D, E, F): Only if check-in is in window
          if (['A', 'B', 'C', 'D', 'E', 'F'].includes(rule.code)) {
            return checkinInWindow;
          }
          
          // Check-out based rules (G, H): Only if check-out is in window  
          if (['G', 'H'].includes(rule.code)) {
            return checkoutInWindow;
          }
          
          return false; // Unknown rule code
        });

        if (missingRules.length > 0) {
          
          const results = await this.generateForReservation(reservation, missingRules);
          const generatedCount = results.filter(r => r.status === 'created').length;
          
          if (generatedCount > 0) {
            totalGenerated += generatedCount;
            allResults.push({
              reservation_id: reservation.id,
              generated: generatedCount,
              results
            });
          }
        } else {
          // Reservation already has complete message set
        }
      }

      if (totalGenerated > 0) {
        console.log(`✅ [OPTIMIZED] Reconciliation complete: ${totalGenerated} messages generated for ${allResults.length} reservations`);
      }
      
      return {
        processed: allResults.length,
        totalGenerated,
        results: allResults
      };

    } catch (error) {
      console.error('❌ Error in reconciliation:', error);
      throw error;
    }
  }

  // Cancel existing scheduled messages for a reservation (used when dates change)
  async cancelExistingMessages(reservationId) {
    try {
      console.log(`🗑️ Canceling existing scheduled messages for reservation ${reservationId}`);
      
      const { error } = await this.supabase.rpc('cancel_pending_for_reservation', {
        p_res: reservationId
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Canceled existing messages for reservation ${reservationId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error canceling existing messages:', error);
      throw error;
    }
  }

  // Handle reservation updates (cancel old messages and generate new ones)
  async handleReservationUpdate(oldReservation, newReservation) {
    try {
      // Check if dates or key fields changed
      const datesChanged = 
        oldReservation.check_in_date !== newReservation.check_in_date ||
        oldReservation.check_out_date !== newReservation.check_out_date ||
        oldReservation.check_in_time !== newReservation.check_in_time ||
        oldReservation.check_out_time !== newReservation.check_out_time;

      if (!datesChanged) {
        console.log(`📝 No date changes for reservation ${newReservation.id}, skipping message regeneration`);
        return { updated: false, reason: 'no_date_changes' };
      }

      console.log(`🔄 Handling reservation update for ${newReservation.id} - dates changed`);

      // Cancel existing pending messages
      await this.cancelExistingMessages(newReservation.id);

      // Generate new messages with updated dates
      const results = await this.generateForReservation(newReservation);

      return {
        updated: true,
        canceled_existing: true,
        generated_new: results.filter(r => r.status === 'created').length,
        results
      };

    } catch (error) {
      console.error('❌ Error handling reservation update:', error);
      throw error;
    }
  }

  // Generate messages for a specific reservation on demand (admin utility)
  async regenerateForReservation(reservationId, cancelExisting = true) {
    try {
      console.log(`🔧 Regenerating messages for reservation ${reservationId}`);

      // Get the reservation with full details
      const { data: reservation, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          properties(name, wifi_name, wifi_password),
          room_units(unit_number),
          message_threads(id)
        `)
        .eq('id', reservationId)
        .single();

      if (error || !reservation) {
        throw new Error('Reservation not found');
      }

      if (!reservation.message_threads) {
        throw new Error('No message thread found for reservation');
      }

      reservation.thread_id = reservation.message_threads.id;

      // Cancel existing if requested
      if (cancelExisting) {
        await this.cancelExistingMessages(reservationId);
      }

      // Generate new messages
      const results = await this.generateForReservation(reservation);

      return {
        reservation_id: reservationId,
        canceled_existing: cancelExisting,
        generated: results.filter(r => r.status === 'created').length,
        results
      };

    } catch (error) {
      console.error('❌ Error regenerating messages:', error);
      throw error;
    }
  }

  // Admin utility: Preview what messages would be generated for a reservation
  async previewMessagesForReservation(reservationId) {
    try {
      // Get the reservation
      const { data: reservation, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          properties(name, wifi_name, wifi_password),
          room_units(unit_number)
        `)
        .eq('id', reservationId)
        .single();

      if (error || !reservation) {
        throw new Error('Reservation not found');
      }

      // Get rules
      const rules = await this.getEnabledRules(reservation.property_id);
      const currentTime = DateTime.now().setZone('Asia/Tokyo');
      const preview = [];

      for (const rule of rules.filter(r => r.enabled)) {
        const scheduledAt = this.computeScheduledAt(rule, reservation);
        const shouldCreate = this.shouldCreateMessage(rule, scheduledAt, reservation, currentTime);
        const payload = this.buildPayload(reservation);

        preview.push({
          rule_code: rule.code,
          rule_name: rule.name,
          template_name: rule.message_templates?.name || 'Unknown Template',
          channel: rule.message_templates?.channel || 'unknown',
          scheduled_at: scheduledAt.toISO(),
          scheduled_at_local: scheduledAt.toLocaleString(DateTime.DATETIME_FULL),
          will_create: shouldCreate,
          backfill_policy: rule.backfill,
          payload
        });
      }

      return {
        reservation_id: reservationId,
        reservation_details: {
          booking_name: reservation.booking_name,
          check_in_date: reservation.check_in_date,
          check_out_date: reservation.check_out_date,
          property_name: reservation.properties?.name
        },
        preview_time: currentTime.toISO(),
        messages: preview
      };

    } catch (error) {
      console.error('❌ Error previewing messages:', error);
      throw error;
    }
  }

  // Clean up expired leases (maintenance function)
  async cleanupExpiredLeases() {
    try {
      const { data: cleanedUp, error } = await this.supabase.rpc('cleanup_expired_leases');
      
      if (error) {
        throw error;
      }

      if (cleanedUp > 0) {
        console.log(`🧹 Cleaned up ${cleanedUp} expired message leases`);
      }

      return cleanedUp;
    } catch (error) {
      console.error('❌ Error cleaning up expired leases:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const generatorService = new ScheduledMessageGeneratorService();

module.exports = generatorService;
