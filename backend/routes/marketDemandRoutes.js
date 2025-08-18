const express = require('express');
const router = express.Router();
const smartMarketDemandService = require('../services/smartMarketDemandService');
const competitorService = require('../services/competitorService');
const { adminAuth } = require('../middleware/auth');

// All routes require authentication
router.use(adminAuth);

/**
 * Market Factor Management
 */

// Get market factor breakdown for "why this price" display
router.get('/factors/:locationId/:date/breakdown', async (req, res) => {
  try {
    const { locationId, date } = req.params;
    const breakdown = await smartMarketDemandService.getMarketFactorBreakdown(
      locationId === 'null' ? null : locationId, 
      date
    );
    res.json(breakdown);
  } catch (error) {
    console.error('Error fetching market factor breakdown:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set manual override for a specific date
router.post('/factors/:locationId/:date/override', async (req, res) => {
  try {
    const { locationId, date } = req.params;
    const { manual_multiplier, lock_auto = false, notes = '' } = req.body;

    if (!manual_multiplier || manual_multiplier <= 0) {
      return res.status(400).json({ error: 'manual_multiplier must be a positive number' });
    }

    const result = await smartMarketDemandService.setManualOverride(
      locationId === 'null' ? null : locationId,
      date,
      parseFloat(manual_multiplier),
      Boolean(lock_auto),
      notes
    );

    res.json(result);
  } catch (error) {
    console.error('Error setting manual override:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update smart market factors for a room type and date range
router.post('/factors/:roomTypeId/calculate', async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { from_date, to_date, location_id = null } = req.body;

    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    const result = await smartMarketDemandService.updateSmartMarketFactors(
      roomTypeId,
      from_date,
      to_date,
      location_id === 'null' ? null : location_id
    );

    res.json(result);
  } catch (error) {
    console.error('Error calculating smart market factors:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Market Tuning Parameters
 */

// Get tuning parameters for a location
router.get('/tuning/:locationId?', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const tuning = await smartMarketDemandService.getTuningForLocation(locationId);
    res.json(tuning);
  } catch (error) {
    console.error('Error fetching tuning parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update tuning parameters
router.put('/tuning/:locationId?', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const tuningParams = req.body;

    // Validate required numeric fields
    const requiredNumeric = ['w_pickup', 'w_avail', 'w_event', 'alpha', 'beta', 'demand_min', 'demand_max'];
    for (const field of requiredNumeric) {
      if (tuningParams[field] !== undefined) {
        const value = parseFloat(tuningParams[field]);
        if (isNaN(value)) {
          return res.status(400).json({ error: `${field} must be a valid number` });
        }
        tuningParams[field] = value;
      }
    }

    const result = await smartMarketDemandService.updateTuning(locationId, tuningParams);
    res.json(result);
  } catch (error) {
    console.error('Error updating tuning parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Competitor Management
 */

// Get competitor sets for a location
router.get('/competitors/:locationId?', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const sets = await competitorService.getCompetitorSets(locationId);
    res.json(sets);
  } catch (error) {
    console.error('Error fetching competitor sets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new competitor set
router.post('/competitors/:locationId/sets', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = await competitorService.createCompetitorSet(locationId, name, description);
    res.json(result);
  } catch (error) {
    console.error('Error creating competitor set:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add competitor to set
router.post('/competitors/sets/:setId/members', async (req, res) => {
  try {
    const { setId } = req.params;
    const competitorData = req.body;

    if (!competitorData.label) {
      return res.status(400).json({ error: 'label is required' });
    }

    const result = await competitorService.addCompetitor(setId, competitorData);
    res.json(result);
  } catch (error) {
    console.error('Error adding competitor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update competitor
router.put('/competitors/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const updateData = req.body;

    const result = await competitorService.updateCompetitor(memberId, updateData);
    res.json(result);
  } catch (error) {
    console.error('Error updating competitor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove competitor
router.delete('/competitors/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { permanent = false } = req.query;

    const result = await competitorService.removeCompetitor(memberId, Boolean(permanent));
    res.json(result);
  } catch (error) {
    console.error('Error removing competitor:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Competitor Price Data
 */

// Input competitor prices for a date
router.post('/competitors/sets/:setId/prices', async (req, res) => {
  try {
    const { setId } = req.params;
    const { date, prices } = req.body;

    if (!date || !prices) {
      return res.status(400).json({ error: 'date and prices are required' });
    }

    const result = await competitorService.inputCompetitorPrices(setId, date, prices);
    res.json(result);
  } catch (error) {
    console.error('Error inputting competitor prices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk input competitor prices
router.post('/competitors/sets/:setId/prices/bulk', async (req, res) => {
  try {
    const { setId } = req.params;
    const { price_data } = req.body; // [{ date, prices }, ...]

    if (!price_data || !Array.isArray(price_data)) {
      return res.status(400).json({ error: 'price_data must be an array of {date, prices} objects' });
    }

    const result = await competitorService.bulkInputCompetitorPrices(setId, price_data);
    res.json(result);
  } catch (error) {
    console.error('Error bulk inputting competitor prices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get competitor prices for date range
router.get('/competitors/sets/:setId/prices', async (req, res) => {
  try {
    const { setId } = req.params;
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date query parameters are required' });
    }

    const result = await competitorService.getCompetitorPrices(setId, from_date, to_date);
    res.json(result);
  } catch (error) {
    console.error('Error fetching competitor prices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get competitor summary for location
router.get('/competitors/:locationId/summary', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const { days = 30 } = req.query;

    const result = await competitorService.getCompetitorSummary(locationId, parseInt(days));
    res.json(result);
  } catch (error) {
    console.error('Error fetching competitor summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get competitor positioning analysis
router.get('/competitors/sets/:setId/positioning/:roomTypeId/:date', async (req, res) => {
  try {
    const { setId, roomTypeId, date } = req.params;

    const result = await competitorService.getCompetitorPositioning(setId, roomTypeId, date);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing competitor positioning:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import competitor data from CSV
router.post('/competitors/sets/:setId/import/csv', async (req, res) => {
  try {
    const { setId } = req.params;
    const { csv_data } = req.body;

    if (!csv_data) {
      return res.status(400).json({ error: 'csv_data is required' });
    }

    const result = await competitorService.importFromCSV(setId, csv_data);
    res.json(result);
  } catch (error) {
    console.error('Error importing CSV data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Events & Holidays Management
 */

// Get holidays for location and date range
router.get('/holidays/:locationId?', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const { from_date, to_date } = req.query;

    let query = supabaseAdmin
      .from('holidays')
      .select('*')
      .eq('is_active', true);

    // Handle location filter properly
    if (locationId === null) {
      query = query.is('location_id', null);
    } else {
      query = query.or(`location_id.is.null,location_id.eq.${locationId}`);
    }

    query = query.order('dt');

    if (from_date && to_date) {
      query = query.gte('dt', from_date).lte('dt', to_date);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add/update holiday
router.post('/holidays', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { location_id, dt, tag, weight, title } = req.body;

    if (!dt || !tag || !title) {
      return res.status(400).json({ error: 'dt, tag, and title are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('holidays')
      .upsert([{
        location_id: location_id === 'null' ? null : location_id,
        dt,
        tag,
        weight: weight ? parseFloat(weight) : 1.05,
        title
      }], {
        onConflict: 'location_id,dt,tag',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error adding holiday:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get events for location and date range
router.get('/events/:locationId?', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const { from_date, to_date } = req.query;

    let query = supabaseAdmin
      .from('events')
      .select('*')
      .eq('is_active', true);

    // Handle location filter properly
    if (locationId === null) {
      query = query.is('location_id', null);
    } else {
      query = query.or(`location_id.is.null,location_id.eq.${locationId}`);
    }

    query = query.order('start_date');

    if (from_date && to_date) {
      query = query.lte('start_date', to_date).gte('end_date', from_date);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add/update event
router.post('/events', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { location_id, title, start_date, end_date, weight, description, url } = req.body;

    if (!title || !start_date || !end_date) {
      return res.status(400).json({ error: 'title, start_date, and end_date are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert([{
        location_id: location_id === 'null' ? null : location_id,
        title,
        start_date,
        end_date,
        weight: weight ? parseFloat(weight) : 1.10,
        description,
        url
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update event
router.put('/events/:eventId', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { eventId } = req.params;
    const updateData = req.body;

    if (updateData.weight) {
      updateData.weight = parseFloat(updateData.weight);
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete event
router.delete('/events/:eventId', async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/supabase');
    const { eventId } = req.params;

    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Seasonality Management
 */

// Get seasonality settings for location
router.get('/seasonality/:locationId?', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const settings = await smartMarketDemandService.getSeasonalitySettings(locationId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching seasonality settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update seasonality settings for location
router.put('/seasonality/:locationId?', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    const { settings } = req.body;

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({ error: 'settings must be an array of seasonality configurations' });
    }

    // Validate each setting
    for (const setting of settings) {
      if (!setting.season_name || !setting.start_date || !setting.end_date || !setting.multiplier) {
        return res.status(400).json({ error: 'Each setting must have season_name, start_date, end_date, and multiplier' });
      }

      const multiplier = parseFloat(setting.multiplier);
      if (multiplier <= 0) {
        return res.status(400).json({ error: 'multiplier must be greater than 0' });
      }

      // Validate date format
      const startDate = new Date(setting.start_date);
      const endDate = new Date(setting.end_date);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'start_date and end_date must be valid dates (YYYY-MM-DD format)' });
      }
    }

    const result = await smartMarketDemandService.updateSeasonalitySettings(locationId, settings);
    res.json(result);
  } catch (error) {
    console.error('Error updating seasonality settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset seasonality settings to defaults
router.post('/seasonality/:locationId?/reset', async (req, res) => {
  try {
    const locationId = req.params.locationId === 'null' ? null : req.params.locationId;
    
    const defaultSettings = [
      { season_name: 'Winter', start_date: '2024-12-01', end_date: '2025-02-28', multiplier: 0.92, year_recurring: true },
      { season_name: 'Spring', start_date: '2024-03-01', end_date: '2024-05-31', multiplier: 0.97, year_recurring: true },
      { season_name: 'Summer', start_date: '2024-06-01', end_date: '2024-08-31', multiplier: 1.15, year_recurring: true },
      { season_name: 'Fall', start_date: '2024-09-01', end_date: '2024-11-30', multiplier: 1.05, year_recurring: true }
    ];

    const result = await smartMarketDemandService.updateSeasonalitySettings(locationId, defaultSettings);
    res.json({ success: true, settings: result });
  } catch (error) {
    console.error('Error resetting seasonality settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual Trigger Endpoints (for testing/admin use)
 */

// Trigger smart market factor calculation manually
router.post('/trigger/calculate-factors', async (req, res) => {
  try {
    const cronService = require('../services/cronService');
    await cronService.triggerMarketFactorUpdate();
    res.json({ success: true, message: 'Smart market factor calculation triggered' });
  } catch (error) {
    console.error('Error triggering factor calculation:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
