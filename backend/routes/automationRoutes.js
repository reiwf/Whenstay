const express = require('express');
const router = express.Router();
const generatorService = require('../services/scheduler/generatorService');
const cronService = require('../services/cronService');
const communicationService = require('../services/communicationService');
const { adminAuth } = require('../middleware/auth');


// Get scheduled messages for a specific reservation
router.get('/scheduled-messages/:reservationId', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { supabaseAdmin } = require('../config/supabase');
    
    // Query scheduled_messages directly by reservation_id since it has this field
    const { data: scheduledMessages, error: messagesError } = await supabaseAdmin
      .from('scheduled_messages')
      .select(`
        *,
        message_templates(name, content),
        message_rules(name, type, code)
      `)
      .eq('reservation_id', reservationId)
      .order('run_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching scheduled messages:', messagesError);
      throw messagesError;
    }

    console.log(`Found ${scheduledMessages?.length || 0} scheduled messages for reservation ${reservationId}`);

    res.json({ 
      scheduledMessages: scheduledMessages || [],
      reservationId,
      count: scheduledMessages?.length || 0
    });
  } catch (error) {
    console.error('Error fetching scheduled messages for reservation:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled messages for reservation' });
  }
});

// Get scheduled messages (all)
router.get('/scheduled-messages', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, status = 'queued' } = req.query;
    const { supabaseAdmin } = require('../config/supabase');
    
    let query = supabaseAdmin
      .from('scheduled_messages')
      .select(`
        *,
        message_templates(name, content),
        message_threads(subject, reservation_id),
        message_rules(name, code)
      `)
      .order('run_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: scheduledMessages, error } = await query;
    if (error) throw error;

    res.json({ 
      scheduledMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: scheduledMessages?.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled messages' });
  }
});

// Get automation statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    
    // Get counts by status
    const { data: statusCounts, error: statusError } = await supabaseAdmin
      .from('scheduled_messages')
      .select('status')
      .then(({ data, error }) => {
        if (error) throw error;
        const counts = {};
        data?.forEach(msg => {
          counts[msg.status] = (counts[msg.status] || 0) + 1;
        });
        return { data: counts, error: null };
      });

    if (statusError) throw statusError;

    // Get recent activity
    const { data: recentActivity, error: recentError } = await supabaseAdmin
      .from('scheduled_messages')
      .select(`
        id, status, run_at, created_at,
        message_templates(name),
        message_threads(reservation_id)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    // Get cron job status
    const cronStatus = cronService.getJobsStatus();

    res.json({
      statusCounts,
      recentActivity,
      cronStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching automation stats:', error);
    res.status(500).json({ error: 'Failed to fetch automation stats' });
  }
});

// Trigger backfill for existing reservations
router.post('/backfill', adminAuth, async (req, res) => {
  try {
    const { daysAhead = 14 } = req.body;
    
    // Use the new generator service reconciliation method
    const results = await generatorService.reconcileForFutureArrivals(parseInt(daysAhead));

    res.json({
      success: true,
      message: 'Backfill completed',
      results
    });
  } catch (error) {
    console.error('Error in backfill:', error);
    res.status(500).json({ error: 'Backfill failed', message: error.message });
  }
});

// Manually trigger scheduled message processing
router.post('/process-scheduled', adminAuth, async (req, res) => {
  try {
    await cronService.triggerScheduledMessageProcessing();
    res.json({ success: true, message: 'Scheduled message processing triggered' });
  } catch (error) {
    console.error('Error triggering scheduled message processing:', error);
    res.status(500).json({ error: 'Failed to trigger processing', message: error.message });
  }
});

// Test automation for a specific reservation
router.post('/test-reservation/:reservationId', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { cancelExisting = true } = req.body;
    
    // Get reservation details
    const { supabaseAdmin } = require('../config/supabase');
    const { data: reservation, error } = await supabaseAdmin
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
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Use regenerate method from generator service
    const results = await generatorService.regenerateForReservation(reservationId, cancelExisting);

    res.json({
      success: true,
      message: 'Message generation completed',
      reservation: {
        id: reservation.id,
        beds24_booking_id: reservation.beds24_booking_id,
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date
      },
      results
    });
  } catch (error) {
    console.error('Error testing automation:', error);
    res.status(500).json({ error: 'Automation test failed', message: error.message });
  }
});

// Cancel scheduled messages for a reservation
router.post('/cancel-reservation/:reservationId', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { reason = 'Manual cancellation' } = req.body;
    
    const result = await generatorService.cancelExistingMessages(reservationId);

    res.json({
      success: true,
      message: 'Cancelled scheduled messages for reservation',
      result
    });
  } catch (error) {
    console.error('Error cancelling scheduled messages:', error);
    res.status(500).json({ error: 'Failed to cancel messages', message: error.message });
  }
});

// Get due messages (for debugging)
router.get('/due-messages', adminAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const dueMessages = await communicationService.getDueScheduledMessages(parseInt(limit));
    
    res.json({ 
      dueMessages,
      count: dueMessages?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching due messages:', error);
    res.status(500).json({ error: 'Failed to fetch due messages' });
  }
});

// Get cron job status
router.get('/cron-status', adminAuth, async (req, res) => {
  try {
    const status = cronService.getJobsStatus();
    res.json({ status, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching cron status:', error);
    res.status(500).json({ error: 'Failed to fetch cron status' });
  }
});

// ===== MESSAGE TEMPLATE MANAGEMENT =====

// Get all message templates
router.get('/templates', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.query;
    const { supabaseAdmin } = require('../config/supabase');
    
    let query = supabaseAdmin
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by property if specified
    if (propertyId && propertyId !== 'null') {
      query = query.eq('property_id', propertyId);
    } else if (propertyId === 'null') {
      query = query.is('property_id', null);
    }

    const { data: templates, error } = await query;
    if (error) throw error;

    res.json({ 
      templates: templates || [],
      count: templates?.length || 0
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template statistics
router.get('/templates/stats', adminAuth, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    
    // Get total count only
    const { data: templates, error } = await supabaseAdmin
      .from('message_templates')
      .select('id');

    if (error) throw error;

    const stats = {
      total: templates?.length || 0
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching template stats:', error);
    res.status(500).json({ error: 'Failed to fetch template stats' });
  }
});


// Get single template details
router.get('/templates/:templateId', adminAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { supabaseAdmin } = require('../config/supabase');

    const { data: template, error } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/templates', adminAuth, async (req, res) => {
  try {
    const { name, content, variables, language, channel, enabled, property_id } = req.body;
    const { supabaseAdmin } = require('../config/supabase');

    // Validate input
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Template content is required' });
    }

    const templateData = {
      name: name.trim(),
      content: content.trim(),
      language: language || 'en',
      channel: channel || 'email',
      enabled: enabled !== undefined ? enabled : true,
      variables: variables || [],
      property_id: property_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .insert(templateData)
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Template created successfully',
      template: data
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template content
router.put('/templates/:templateId', adminAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, content, variables, language, channel, enabled } = req.body;
    const { supabaseAdmin } = require('../config/supabase');

    // Validate input
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Template content is required' });
    }

    const updateData = {
      content: content.trim(),
      updated_at: new Date().toISOString()
    };

    if (name) updateData.name = name.trim();
    if (variables) updateData.variables = variables;
    if (language) updateData.language = language;
    if (channel) updateData.channel = channel;
    if (enabled !== undefined) updateData.enabled = enabled;

    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .update(updateData)
      .eq('id', templateId)
      .select('*')
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      template: data
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Get available template variables
router.get('/templates/variables/available', adminAuth, async (req, res) => {
  try {
    // Define available variables grouped by category
    const availableVariables = {
      guest: {
        label: 'Guest Information',
        variables: [
          { key: 'guest_name', label: 'Guest Name', description: 'Full name of the primary guest' },
          { key: 'guest_firstname', label: 'Guest First Name', description: 'First name of the primary guest' },
          { key: 'guest_lastname', label: 'Guest Last Name', description: 'Last name of the primary guest' },
          { key: 'guest_email', label: 'Guest Email', description: 'Email address of the primary guest' },
          { key: 'guest_phone', label: 'Guest Phone', description: 'Phone number of the primary guest' },
          { key: 'num_guests', label: 'Number of Guests', description: 'Total number of guests in the reservation' },
          { key: 'num_adults', label: 'Number of Adults', description: 'Number of adult guests' },
          { key: 'num_children', label: 'Number of Children', description: 'Number of child guests' }
        ]
      },
      reservation: {
        label: 'Reservation Details',
        variables: [
          { key: 'check_in_date', label: 'Check-in Date', description: 'Reservation check-in date' },
          { key: 'check_out_date', label: 'Check-out Date', description: 'Reservation check-out date' },
          { key: 'booking_id', label: 'Booking ID', description: 'Unique booking reference number' },
          { key: 'nights_count', label: 'Number of Nights', description: 'Total nights for the stay' },
          { key: 'total_amount', label: 'Total Amount', description: 'Total reservation cost' },
          { key: 'currency', label: 'Currency', description: 'Currency code (e.g., JPY, USD)' },
          { key: 'booking_source', label: 'Booking Source', description: 'Platform where booking was made' },
          { key: 'special_requests', label: 'Special Requests', description: 'Guest special requests or notes' },
          { key: 'check_in_token', label: 'Check-in Token', description: 'Unique guest check-in token for authentication' },
          { key: 'guest_app_link', label: 'Guest App Magic Link', description: 'Direct link to guest app with authentication' }
        ]
      },
      property: {
        label: 'Property Information',
        variables: [
          { key: 'property_name', label: 'Property Name', description: 'Name of the property' },
          { key: 'property_address', label: 'Property Address', description: 'Full property address' },
          { key: 'wifi_name', label: 'WiFi Name', description: 'WiFi network name' },
          { key: 'wifi_password', label: 'WiFi Password', description: 'WiFi password' },
          { key: 'check_in_instructions', label: 'Check-in Instructions', description: 'Property check-in instructions' },
          { key: 'house_rules', label: 'House Rules', description: 'Property house rules' },
          { key: 'emergency_contact', label: 'Emergency Contact', description: 'Property emergency contact information' },
          { key: 'access_time', label: 'Check-in Time', description: 'Property check-in/access time (e.g., 15:00)' },
          { key: 'departure_time', label: 'Check-out Time', description: 'Property check-out/departure time (e.g., 11:00)' }
        ]
      },
      room: {
        label: 'Room Information',
        variables: [
          { key: 'room_type_name', label: 'Room Type Name', description: 'Name of the room type' },
          { key: 'room_number', label: 'Room Number', description: 'Specific room/unit number' },
          { key: 'access_code', label: 'Room Access Code', description: 'Room access code or key information' },
          { key: 'access_instructions', label: 'Room Access Instructions', description: 'Instructions for accessing the room' },
          { key: 'room_amenities', label: 'Room Amenities', description: 'List of room amenities' },
          { key: 'bed_configuration', label: 'Bed Configuration', description: 'Room bed setup information' },
          { key: 'max_guests', label: 'Maximum Guests', description: 'Maximum number of guests for the room' }
        ]
      },
      system: {
        label: 'System Information',
        variables: [
          { key: 'current_date', label: 'Current Date', description: 'Today\'s date' },
          { key: 'current_time', label: 'Current Time', description: 'Current time' },
          { key: 'company_name', label: 'Company Name', description: 'Your company name' },
          { key: 'support_email', label: 'Support Email', description: 'Customer support email' },
          { key: 'support_phone', label: 'Support Phone', description: 'Customer support phone number' }
        ]
      }
    };

    res.json({ variables: availableVariables });
  } catch (error) {
    console.error('Error fetching available variables:', error);
    res.status(500).json({ error: 'Failed to fetch available variables' });
  }
});

// Associate template with rule (for new language templates)
router.post('/rules/:ruleId/templates', adminAuth, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { templateId, isPrimary = false, priority = 0 } = req.body;
    const { supabaseAdmin } = require('../config/supabase');

    // Validate that rule and template exist
    const [ruleCheck, templateCheck] = await Promise.all([
      supabaseAdmin.from('message_rules').select('id').eq('id', ruleId).single(),
      supabaseAdmin.from('message_templates').select('id').eq('id', templateId).single()
    ]);

    if (ruleCheck.error || !ruleCheck.data) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (templateCheck.error || !templateCheck.data) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if association already exists
    const { data: existing } = await supabaseAdmin
      .from('message_rule_templates')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('template_id', templateId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Rule-template association already exists' });
    }

    // If this should be primary, unmark other primary templates for this rule
    if (isPrimary) {
      await supabaseAdmin
        .from('message_rule_templates')
        .update({ is_primary: false })
        .eq('rule_id', ruleId);
    }

    // Create the association
    const { data: association, error } = await supabaseAdmin
      .from('message_rule_templates')
      .insert({
        rule_id: ruleId,
        template_id: templateId,
        is_primary: isPrimary,
        priority: priority,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Template associated with rule successfully',
      association
    });

  } catch (error) {
    console.error('Error associating template with rule:', error);
    res.status(500).json({ error: 'Failed to associate template with rule' });
  }
});

// Get template usage statistics
router.get('/templates/:templateId/usage', adminAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { supabaseAdmin } = require('../config/supabase');

    // Get template info
    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('id, name, enabled')
      .eq('id', templateId)
      .single();

    if (templateError) throw templateError;

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get scheduled message counts
    const { data: scheduledCounts, error: scheduledError } = await supabaseAdmin
      .from('scheduled_messages')
      .select('status')
      .eq('template_id', templateId);

    if (scheduledError) throw scheduledError;

    // Get message rules using this template
    const { data: messageRules, error: rulesError } = await supabaseAdmin
      .from('message_rules')
      .select('id, name, enabled, code')
      .eq('template_id', templateId);

    if (rulesError) throw rulesError;

    // Calculate statistics
    const scheduledStats = {
      total: scheduledCounts?.length || 0,
      queued: scheduledCounts?.filter(m => m.status === 'queued').length || 0,
      sent: scheduledCounts?.filter(m => m.status === 'sent').length || 0,
      canceled: scheduledCounts?.filter(m => m.status === 'canceled').length || 0,
      failed: scheduledCounts?.filter(m => m.status === 'failed').length || 0
    };

    res.json({
      template,
      scheduledStats,
      messageRules: messageRules || [],
      activeRules: messageRules?.filter(r => r.enabled).length || 0
    });
  } catch (error) {
    console.error('Error fetching template usage:', error);
    res.status(500).json({ error: 'Failed to fetch template usage' });
  }
});

module.exports = router;
