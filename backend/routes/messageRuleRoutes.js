const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const generatorService = require('../services/scheduler/generatorService');
const router = express.Router();

// ===== MESSAGE RULES MANAGEMENT =====

// Get all message rules
router.get('/rules', async (req, res) => {
  try {
    const { property_id } = req.query;
    
    let query = supabaseAdmin
      .from('message_rules')
      .select(`
        *,
        message_templates(*)
      `)
      .order('code');

    if (property_id) {
      query = query.or(`property_id.eq.${property_id},property_id.is.null`);
    }

    const { data: rules, error } = await query;
    
    if (error) {
      throw error;
    }

    res.json({
      success: true,
      rules: rules || []
    });

  } catch (error) {
    console.error('Error fetching message rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update a message rule
router.put('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;
    
    // Validate allowed fields
    const allowedFields = ['enabled', 'days', 'hours', 'at_time', 'delay_minutes', 'backfill', 'timezone'];
    const updateData = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from('message_rules')
      .update(updateData)
      .eq('id', ruleId)
      .select(`
        *,
        message_templates(*)
      `)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      rule: updated
    });

  } catch (error) {
    console.error('Error updating message rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== SCHEDULED MESSAGES MANAGEMENT =====

// Get scheduled messages for a reservation
router.get('/scheduled/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { status } = req.query;

    let query = supabaseAdmin
      .from('scheduled_messages')
      .select(`
        *,
        message_templates(name, channel),
        message_rules(code, name, type)
      `)
      .eq('reservation_id', reservationId)
      .order('run_at');

    if (status) {
      query = query.eq('status', status);
    }

    const { data: scheduled, error } = await query;
    
    if (error) {
      throw error;
    }

    res.json({
      success: true,
      scheduled_messages: scheduled || []
    });

  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Preview messages for a reservation (without creating them)
router.get('/preview/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    const preview = await generatorService.previewMessagesForReservation(reservationId);
    
    res.json({
      success: true,
      preview
    });

  } catch (error) {
    console.error('Error previewing messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate scheduled messages for a reservation manually
router.post('/generate/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { cancel_existing = true } = req.body;
    
    const result = await generatorService.regenerateForReservation(reservationId, cancel_existing);
    
    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Error generating messages for reservation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel scheduled messages for a reservation
router.delete('/cancel/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    const result = await generatorService.cancelExistingMessages(reservationId);
    
    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Error canceling messages for reservation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== ADMIN UTILITIES =====

// Get system status and stats
router.get('/status', async (req, res) => {
  try {
    // Get scheduled message statistics
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('scheduled_messages')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (statsError) {
      throw statsError;
    }

    const statusCounts = {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      canceled: 0,
      skipped: 0
    };

    (stats || []).forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    // Get recent activity
    const { data: recentActivity, error: activityError } = await supabaseAdmin
      .from('scheduled_messages')
      .select(`
        id,
        status,
        run_at,
        updated_at,
        attempts,
        last_error,
        message_rules(code, name)
      `)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (activityError) {
      console.warn('Could not fetch recent activity:', activityError);
    }

    res.json({
      success: true,
      status: {
        last_24h_stats: statusCounts,
        recent_activity: recentActivity || [],
        system_time: new Date().toISOString(),
        timezone: 'Asia/Tokyo'
      }
    });

  } catch (error) {
    console.error('Error getting message system status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test message generation for recent reservations
router.post('/test/recent', async (req, res) => {
  try {
    const { minutes_back = 60 } = req.body;
    
    console.log(`🔧 Manual test: generating messages for reservations from last ${minutes_back} minutes`);
    
    const result = await generatorService.generateForRecentReservations(minutes_back);
    
    res.json({
      success: true,
      test_type: 'recent_reservations',
      minutes_back,
      result
    });

  } catch (error) {
    console.error('Error testing recent reservation generation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test reconciliation for future arrivals
router.post('/test/reconcile', async (req, res) => {
  try {
    const { days_ahead = 30 } = req.body;
    
    console.log(`🔧 Manual test: reconciling messages for arrivals in next ${days_ahead} days`);
    
    const result = await generatorService.reconcileForFutureArrivals(days_ahead);
    
    res.json({
      success: true,
      test_type: 'future_reconciliation',
      days_ahead,
      result
    });

  } catch (error) {
    console.error('Error testing future reconciliation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual lease cleanup
router.post('/cleanup/leases', async (req, res) => {
  try {
    console.log('🧹 Manual lease cleanup triggered');
    
    const cleanedUp = await generatorService.cleanupExpiredLeases();
    
    res.json({
      success: true,
      cleaned_up: cleanedUp,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error cleaning up leases:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get message rule summary (admin dashboard view)
router.get('/summary', async (req, res) => {
  try {
    // Get rule counts by status
    const { data: ruleCounts } = await supabaseAdmin
      .from('message_rules')
      .select('enabled, code')
      .order('code');

    const enabledRules = (ruleCounts || []).filter(r => r.enabled);
    const disabledRules = (ruleCounts || []).filter(r => !r.enabled);

    // Get template counts
    const { data: templateCounts } = await supabaseAdmin
      .from('message_templates')
      .select('enabled, channel')
      .order('channel');

    const templatesByChannel = {};
    (templateCounts || []).forEach(t => {
      if (!templatesByChannel[t.channel]) {
        templatesByChannel[t.channel] = { enabled: 0, disabled: 0 };
      }
      templatesByChannel[t.channel][t.enabled ? 'enabled' : 'disabled']++;
    });

    res.json({
      success: true,
      summary: {
        rules: {
          total: (ruleCounts || []).length,
          enabled: enabledRules.length,
          disabled: disabledRules.length,
          enabled_codes: enabledRules.map(r => r.code).sort(),
          disabled_codes: disabledRules.map(r => r.code).sort()
        },
        templates_by_channel: templatesByChannel,
        system_info: {
          architecture: 'Rule-based with lease-controlled processing',
          processing_frequency: 'Every 10 minutes',
          generation_frequency: 'Every 5 minutes',
          timezone: 'Asia/Tokyo'
        }
      }
    });

  } catch (error) {
    console.error('Error getting system summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
