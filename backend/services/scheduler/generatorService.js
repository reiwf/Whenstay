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

  // Channel detection from booking source
  getChannelFromBookingSource(booking_source) {
    if (!booking_source) return 'email'; // Default fallback
    
    const channelMap = {
      'airbnb': 'airbnb',
      'booking.com': 'booking',
      'booking': 'booking',
      'whatsapp': 'whatsapp',
      'direct': 'email',
      'phone': 'sms',
      'email': 'email',
      'website': 'email'
    };
    
    const normalizedSource = booking_source.toLowerCase().trim();
    return channelMap[normalizedSource] || 'email';
  }

  // Extract country code from phone number (improved logic)
  extractCountryCode(phone) {
    if (!phone || typeof phone !== 'string') {
      return null;
    }

    // Clean phone number - remove spaces, dashes, parentheses (but keep + and digits)
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Country code mapping (both with and without + prefix)
    const countryCodeMap = {
      '+81': '+81', '81': '+81',   // Japan
      '+82': '+82', '82': '+82',   // South Korea
      '+86': '+86', '86': '+86',   // China
      '+852': '+852', '852': '+852', // Hong Kong
      '+853': '+853', '853': '+853', // Macau
      '+886': '+886', '886': '+886', // Taiwan
      '+1': '+1', '1': '+1',       // US/Canada
      '+44': '+44', '44': '+44',   // UK
      '+61': '+61', '61': '+61',   // Australia
      '+64': '+64', '64': '+64',   // New Zealand
      '+33': '+33', '33': '+33',   // France
      '+49': '+49', '49': '+49',   // Germany
      '+34': '+34', '34': '+34',   // Spain
      '+39': '+39', '39': '+39',   // Italy
      '+7': '+7', '7': '+7',       // Russia
      '+55': '+55', '55': '+55',   // Brazil
      '+52': '+52', '52': '+52',   // Mexico
      '+91': '+91', '91': '+91',   // India
      '+65': '+65', '65': '+65',   // Singapore
      '+60': '+60', '60': '+60',   // Malaysia
      '+66': '+66', '66': '+66',   // Thailand
      '+84': '+84', '84': '+84',   // Vietnam
      '+62': '+62', '62': '+62'    // Indonesia
    };
    
    // Check for + prefix first
    if (cleaned.startsWith('+')) {
      // Try different code lengths (1-4 digits after +)
      for (let i = 4; i >= 1; i--) {
        const code = cleaned.substring(0, i + 1); // include the +
        if (countryCodeMap[code]) {
          console.log(`🔍 Found country code with +: ${code} for phone: ${phone}`);
          return countryCodeMap[code];
        }
      }
    } else {
      // Check without + prefix for common codes
      const commonCodes = ['81', '82', '86', '852', '853', '886', '1', '44', '61', '64', '33', '49', '34', '39', '7', '55', '52', '91', '65', '60', '66', '84', '62'];
      for (const code of commonCodes) {
        if (cleaned.startsWith(code)) {
          console.log(`🔍 Found country code without +: ${code} for phone: ${phone}`);
          return countryCodeMap[code];
        }
      }
    }
    
    console.log(`⚠️ No country code found for phone: ${phone} (cleaned: ${cleaned})`);
    return null;
  }

  // Language detection from phone country code (improved)
  getLanguageFromPhone(booking_phone) {
    if (!booking_phone) return 'en'; // Default to English
    
    const countryCode = this.extractCountryCode(booking_phone);
    if (!countryCode) {
      console.log(`🌍 No country code detected for ${booking_phone}, defaulting to English`);
      return 'en';
    }
    
    const languageMap = {
      '+81': 'ja',   // Japan
      '+82': 'ko',   // South Korea
      '+86': 'zh',   // China
      '+852': 'zh',  // Hong Kong
      '+853': 'zh',  // Macau
      '+886': 'zh',  // Taiwan
      '+1': 'en',    // US/Canada
      '+44': 'en',   // UK
      '+61': 'en',   // Australia
      '+64': 'en',   // New Zealand
      '+33': 'fr',   // France
      '+49': 'de',   // Germany
      '+34': 'es',   // Spain
      '+39': 'it',   // Italy
      '+7': 'ru',    // Russia
      '+55': 'pt',   // Brazil
      '+52': 'es',   // Mexico
      '+91': 'en',   // India (English as common language)
      '+65': 'en',   // Singapore
      '+60': 'en',   // Malaysia
      '+66': 'th',   // Thailand
      '+84': 'vi',   // Vietnam
      '+62': 'id'    // Indonesia
    };
    
    const detectedLanguage = languageMap[countryCode] || 'en';
    console.log(`🌍 Country code ${countryCode} → Language: ${detectedLanguage} for phone: ${booking_phone}`);
    return detectedLanguage;
  }

  // Template selection with fallback logic
  selectTemplate(templates, preferredChannel, preferredLanguage) {
    if (!templates || templates.length === 0) {
      return null;
    }

    // 1. Try exact match: channel + language
    let match = templates.find(t => 
      t.channel === preferredChannel && 
      t.language === preferredLanguage
    );
    if (match) {
      console.log(`✅ Exact match found: ${preferredChannel} + ${preferredLanguage}`);
      return match;
    }

    // 2. Try channel match with English (common fallback language)
    match = templates.find(t => 
      t.channel === preferredChannel && 
      t.language === 'en'
    );
    if (match) {
      console.log(`✅ Channel match with English fallback: ${preferredChannel} + en`);
      return match;
    }

    // 3. Try email channel with preferred language
    match = templates.find(t => 
      t.channel === 'email' && 
      t.language === preferredLanguage
    );
    if (match) {
      console.log(`✅ Email channel with preferred language: email + ${preferredLanguage}`);
      return match;
    }

    // 4. Try email + English (most common combination)
    match = templates.find(t => 
      t.channel === 'email' && 
      t.language === 'en'
    );
    if (match) {
      console.log(`✅ Email + English fallback`);
      return match;
    }

    // 5. Fall back to primary template
    match = templates.find(t => t.is_primary === true);
    if (match) {
      console.log(`✅ Primary template fallback`);
      return match;
    }

    // 6. Last resort: first available template
    console.log(`⚠️ Using first available template as last resort`);
    return templates[0];
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
    const checkInTime = reservation.check_in_time ;
    const checkOutTime = reservation.check_out_time ;
    
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
        const checkInTime = reservation.check_in_time ;
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
    // Calculate nights count
    const checkInDate = new Date(reservation.check_in_date);
    const checkOutDate = new Date(reservation.check_out_date);
    const nightsCount = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    return {
      // Legacy camelCase variables (for backward compatibility)
      guestName: reservation.booking_name || 'Guest',
      checkInDate: reservation.check_in_date,
      checkInTime: reservation.properties?.access_time || '15:00',
      checkOutDate: reservation.check_out_date,
      checkOutTime: reservation.properties?.departure_time || '11:00',
      propertyName: reservation.property_name || reservation.properties?.name || 'Property',
      room: reservation.room_unit_label || reservation.room_units?.unit_number || 'Your room',
      wifiName: reservation.wifi_name || reservation.properties?.wifi_name || 'WiFi',
      wifiPassword: reservation.wifi_password || reservation.properties?.wifi_password || 'Chat',
      
      // New snake_case variables to match template variable names
      guest_name: reservation.booking_name || 'Guest',
      guest_firstname: reservation.booking_firstname || (reservation.booking_name ? reservation.booking_name.split(' ')[0] : 'Guest'),
      guest_lastname: reservation.booking_lastname || (reservation.booking_name ? reservation.booking_name.split(' ').slice(1).join(' ') : ''),
      guest_email: reservation.booking_email || '',
      guest_phone: reservation.booking_phone || '',
      
      // Guest counts
      num_guests: reservation.num_guests || 1,
      num_adults: reservation.num_adults || 1,
      num_children: reservation.num_children || 0,
      
      // Dates and duration
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      nights_count: nightsCount,
      
      // Booking details
      check_in_token: reservation.check_in_token || '',
      booking_id: reservation.beds24_booking_id || reservation.id,
      total_amount: reservation.total_amount || 0,
      currency: reservation.currency || 'JPY',
      booking_source: reservation.booking_source || 'Direct',
      special_requests: reservation.special_requests || '',
      
      // Property information
      property_name: reservation.property_name || reservation.properties?.name || 'Property',
      property_address: reservation.properties?.address || '',
      wifi_name: reservation.wifi_name || reservation.properties?.wifi_name || 'WiFi',
      wifi_password: reservation.wifi_password || reservation.properties?.wifi_password || 'Ask at front desk',
      check_in_instructions: reservation.properties?.check_in_instructions || '',
      house_rules: reservation.properties?.house_rules || '',
      emergency_contact: reservation.properties?.contact_number || reservation.properties?.property_email || '',
      access_time: reservation.properties?.access_time || '15:00',
      departure_time: reservation.properties?.departure_time || '11:00',
      
      // Room information
      room_number: reservation.room_unit_label || reservation.room_units?.unit_number || 'Your room',
      room_type_name: reservation.room_types?.name || reservation.properties?.name || 'Room',
      access_code: reservation.room_units?.access_code || reservation.properties?.entrance_code || '',
      access_instructions: reservation.room_units?.access_instructions || '',
      room_amenities: reservation.room_types?.room_amenities || reservation.room_units?.unit_amenities || {},
      bed_configuration: reservation.room_types?.bed_configuration || '',
      max_guests: reservation.room_types?.max_guests || reservation.num_guests || 1
      
      // Note: guest_app_link will be dynamically generated in template rendering
    };
  }

  // Generate scheduled messages for a single reservation based on all enabled rules
  async generateForReservation(reservation, rules = null, isRealtimeGeneration = false) {
    try {
      if (isRealtimeGeneration) {
        console.log(`🚀 Real-time generation for reservation ${reservation.id}`);
      }

      // Get rules with templates if not provided
      if (!rules) {
        // Use new method that fetches all templates per rule
        rules = await this.getEnabledRulesWithTemplates(reservation.property_id);
      }

      const results = [];
      const currentTime = DateTime.now().setZone('Asia/Tokyo');

      // Determine preferred channel and language from reservation
      const preferredChannel = this.getChannelFromBookingSource(reservation.booking_source);
      const preferredLanguage = this.getLanguageFromPhone(reservation.booking_phone);

      console.log(`📋 Processing reservation ${reservation.id}:`);
      console.log(`   📱 Booking source: ${reservation.booking_source} → Channel: ${preferredChannel}`);
      console.log(`   🌍 Phone: ${reservation.booking_phone} → Language: ${preferredLanguage}`);

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
              console.log(`⏭️ Skipping rule ${rule.code} - shouldCreate = false`);
            }
            continue;
          }

          // Select appropriate template from available options
          const selectedTemplate = this.selectTemplate(
            rule.templates, 
            preferredChannel, 
            preferredLanguage
          );

          if (!selectedTemplate) {
            console.warn(`⚠️ No suitable template found for rule ${rule.code}, skipping`);
            results.push({
              rule_code: rule.code,
              status: 'error',
              error: 'No suitable template found'
            });
            continue;
          }

          console.log(`✅ Rule ${rule.code}: Selected template ${selectedTemplate.id} (${selectedTemplate.channel}/${selectedTemplate.language})`);

          const idempotencyKey = this.generateIdempotencyKey(rule.id, reservation.id, scheduledAt.toJSDate());
          const payload = this.buildPayload(reservation);

          // Create scheduled message with selected template
          const scheduledMessage = await this.communicationService.scheduleMessage({
            thread_id: reservation.thread_id,
            template_id: selectedTemplate.id,
            channel: selectedTemplate.channel,
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
            selected_template_id: selectedTemplate.id,
            selected_channel: selectedTemplate.channel,
            selected_language: selectedTemplate.language,
            is_primary_template: selectedTemplate.is_primary,
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
      
      console.log(`📊 Generation completed: ${scheduledCount} scheduled, ${immediateCount} immediate, ${results.filter(r => r.status === 'error').length} errors`);
      
      return results;

    } catch (error) {
      console.error('❌ Error generating messages:', error);
      throw error;
    }
  }

  // Get enabled message rules with all their templates (using junction table)
  async getEnabledRulesWithTemplates(propertyId = null) {
    const { data: rulesData, error } = await this.supabase
      .from('message_rules')
      .select(`
        *,
        message_rule_templates!inner(
          is_primary,
          priority,
          message_templates(*)
        )
      `)
      .eq('enabled', true)
      .eq('message_rule_templates.message_templates.enabled', true)
      .or(propertyId ? `property_id.eq.${propertyId},property_id.is.null` : 'property_id.is.null')
      .order('code');

    if (error) {
      console.error('Error fetching message rules with templates:', error);
      throw error;
    }


    // Transform the data to group templates under each rule
    const rulesWithTemplates = rulesData.map(rule => {
      const templates = rule.message_rule_templates.map(rt => ({
        ...rt.message_templates,
        is_primary: rt.is_primary,
        priority: rt.priority
      }));

      // Sort templates by priority (desc) and primary first
      templates.sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return b.priority - a.priority;
      });

      return {
        ...rule,
        templates: templates
      };
    });

    // Validate that all rules have at least one template
    const validRules = rulesWithTemplates.filter(rule => {
      if (!rule.templates || rule.templates.length === 0) {
        console.warn(`Rule ${rule.code} has no templates associated`);
        return false;
      }
      
      // Check if at least one template has a valid channel
      const hasValidTemplate = rule.templates.some(t => t.channel);
      if (!hasValidTemplate) {
        console.warn(`Rule ${rule.code} has no templates with valid channels`);
        return false;
      }

      return true;
    });

    if (validRules.length !== rulesWithTemplates.length) {
      console.warn(`Filtered out ${rulesWithTemplates.length - validRules.length} rules without valid templates`);
    }

    return validRules;
  }

  // Backward compatibility method - returns rules with primary template only
  async getEnabledRules(propertyId = null) {
    const rulesWithTemplates = await this.getEnabledRulesWithTemplates(propertyId);
    
    // Transform to old format for backward compatibility
    return rulesWithTemplates.map(rule => {
      const primaryTemplate = rule.templates.find(t => t.is_primary) || rule.templates[0];
      return {
        ...rule,
        message_templates: primaryTemplate,
        template_id: primaryTemplate?.id
      };
    });
  }

  // Generate messages for recently created reservations (safety net)
  async generateForRecentReservations(minutesBack = 15) {
    try {
      // Log environment status for transparency
      if (!this.shouldSendInCurrentEnvironment()) {
        const environment = process.env.NODE_ENV || 'unknown';
      }

      const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
      
      // Get recent reservations with thread information
      const { data: recentReservations, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          properties(
            name, 
            address,
            wifi_name, 
            wifi_password, 
            check_in_instructions,
            house_rules,
            contact_number,
            property_email,
            access_time,
            departure_time,
            entrance_code
          ),
          room_types(
            name,
            room_amenities,
            bed_configuration,
            max_guests
          ),
          room_units(
            unit_number,
            access_code,
            access_instructions,
            unit_amenities
          ),
          message_threads(id)
        `)
        .gte('created_at', cutoffTime.toISOString())
        .not('status', 'eq', 'cancelled');

      if (error) {
        throw error;
      }

      if (!recentReservations || recentReservations.length === 0) {
        return { processed: 0, results: [] };
      }

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
          skippedCount++;
          continue; // Skip this reservation
        }

        // Ensure reservation has a thread
        // Handle thread_id - use existing thread if available, otherwise null (will be created during processing)
        if (reservation.message_threads) {
          reservation.thread_id = reservation.message_threads.id;
        } else {
          reservation.thread_id = null;
        }

        const results = await this.generateForReservation(reservation);
        allResults.push({
          reservation_id: reservation.id,
          results
        });
      }

      if (skippedCount > 0) {
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
      }

      const currentTime = DateTime.now().setZone('Asia/Tokyo');
      
      // DUAL-WINDOW OPTIMIZATION: Separate windows for check-in vs check-out based rules
      // Check-in based rules (A-F): Need reservations checking in soon or recently
      const checkinWindowStart = currentTime.minus({ days: 5 }).toISODate();
      const checkinWindowEnd = currentTime.plus({ days: daysAhead }).toISODate();
      
      // Check-out based rules (G-H): Need reservations checking out soon (includes long stays)
      const checkoutWindowStart = currentTime.minus({ days: 2 }).toISODate(); // Account for Rule H (1 day after)
      const checkoutWindowEnd = currentTime.plus({ days: 7 }).toISODate();    // 7-day message window
      
      // Get reservations in EITHER window (fixes checkout message gap)
      const { data: targetReservations, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          properties(
            name, 
            address,
            wifi_name, 
            wifi_password, 
            check_in_instructions,
            house_rules,
            contact_number,
            property_email,
            access_time,
            departure_time,
            entrance_code
          ),
          room_types(
            name,
            room_amenities,
            bed_configuration,
            max_guests
          ),
          room_units(
            unit_number,
            access_code,
            access_instructions,
            unit_amenities
          ),
          message_threads(id)
        `)
        .or(`check_in_date.gte.${checkinWindowStart},check_in_date.lte.${checkinWindowEnd},check_out_date.gte.${checkoutWindowStart},check_out_date.lte.${checkoutWindowEnd}`)
        .not('status', 'eq', 'cancelled');

      if (error) {
        throw error;
      }

      if (!targetReservations || targetReservations.length === 0) {
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
      
      const { error } = await this.supabase.rpc('cancel_pending_for_reservation', {
        p_res: reservationId
      });

      if (error) {
        throw error;
      }

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
        return { updated: false, reason: 'no_date_changes' };
      }

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

      // Get the reservation with full details
      const { data: reservation, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          properties(
            name, 
            address,
            wifi_name, 
            wifi_password, 
            check_in_instructions,
            house_rules,
            contact_number,
            property_email,
            access_time,
            departure_time,
            entrance_code
          ),
          room_types(
            name,
            room_amenities,
            bed_configuration,
            max_guests
          ),
          room_units(
            unit_number,
            access_code,
            access_instructions,
            unit_amenities
          ),
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
