const express = require('express');
const router = express.Router();
const pricingService = require('../services/pricingService');
const { supabaseAdmin } = require('../config/supabase');
const { adminAuth } = require('../middleware/auth');

// All pricing routes require admin authentication
router.use(adminAuth);

// GET /api/pricing/rules/:roomTypeId
// Returns: { roomTypeId, rules }
router.get('/rules/:roomTypeId', async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const rules = await pricingService.getRules(roomTypeId);

    res.status(200).json({
      roomTypeId,
      rules
    });
  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    res.status(500).json({ error: 'Failed to fetch pricing rules' });
  }
});

// PUT /api/pricing/rules/:roomTypeId
// Body: partial fields to update
// Returns: upserted rules
router.put('/rules/:roomTypeId', async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const rulesData = req.body;

    if (!roomTypeId) {
      return res.status(400).json({ error: 'Room type ID is required' });
    }

    const rules = await pricingService.updateRules(roomTypeId, rulesData);

    res.status(200).json({
      ok: true,
      rules
    });
  } catch (error) {
    console.error('Error updating pricing rules:', error);
    res.status(500).json({ error: 'Failed to update pricing rules' });
  }
});

// POST /api/pricing/run
// Body: { roomTypeId, from:"YYYY-MM-DD", to:"YYYY-MM-DD" }
// Returns: { ok:true, priced:<count> }
router.post('/run', async (req, res) => {
  try {
    const { roomTypeId, from, to } = req.body;

    if (!roomTypeId || !from || !to) {
      return res.status(400).json({ 
        error: 'roomTypeId, from, and to dates are required' 
      });
    }

    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Dates must be in YYYY-MM-DD format' 
      });
    }

    const result = await pricingService.runPricing(roomTypeId, from, to);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error running pricing calculation:', error);
    res.status(500).json({ error: 'Failed to run pricing calculation' });
  }
});

// GET /api/pricing/calendar?roomTypeId=...&from=...&to=...
// Returns: { roomTypeId, days:[{ date, price, hasOverride }] }
router.get('/calendar', async (req, res) => {
  try {
    const { roomTypeId, from, to } = req.query;

    if (!roomTypeId || !from || !to) {
      return res.status(400).json({ 
        error: 'roomTypeId, from, and to query parameters are required' 
      });
    }

    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Dates must be in YYYY-MM-DD format' 
      });
    }

    const calendar = await pricingService.getCalendar(roomTypeId, from, to);

    res.status(200).json(calendar);
  } catch (error) {
    console.error('Error fetching pricing calendar:', error);
    res.status(500).json({ error: 'Failed to fetch pricing calendar' });
  }
});

// POST /api/pricing/override
// Body: { roomTypeId, date, price, locked }
// Returns: upserted listing price
router.post('/override', async (req, res) => {
  try {
    const { roomTypeId, date, price, locked = false } = req.body;

    if (!roomTypeId || !date) {
      return res.status(400).json({ 
        error: 'roomTypeId and date are required' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        error: 'Date must be in YYYY-MM-DD format' 
      });
    }

    // Validate price if provided
    if (price !== undefined && (isNaN(price) || price < 0)) {
      return res.status(400).json({ 
        error: 'Price must be a non-negative number' 
      });
    }

    // Clamp price within room type bounds using database function
    let clampedPrice = price;
    if (price !== undefined) {
      const { data: clampResult, error: clampError } = await supabaseAdmin
        .rpc('clamp_price', {
          _room_type_id: roomTypeId,
          _price: price
        });

      if (clampError) {
        console.error('Error clamping price:', clampError);
        return res.status(400).json({ error: 'Failed to validate price bounds' });
      }

      clampedPrice = clampResult;

      // Inform user if price was clamped
      if (clampedPrice !== price) {
        const { data: roomTypeData } = await supabaseAdmin
          .from('room_types')
          .select('min_price, max_price')
          .eq('id', roomTypeId)
          .single();

        return res.status(200).json({
          ok: true,
          price_adjusted: true,
          original_price: price,
          clamped_price: clampedPrice,
          room_bounds: {
            min: roomTypeData?.min_price,
            max: roomTypeData?.max_price
          },
          message: `Price adjusted to stay within room type bounds (${roomTypeData?.min_price} - ${roomTypeData?.max_price})`
        });
      }
    }

    const row = await pricingService.setOverride(roomTypeId, date, clampedPrice, locked);

    res.status(200).json({
      ok: true,
      row
    });
  } catch (error) {
    console.error('Error setting price override:', error);
    res.status(500).json({ error: 'Failed to set price override' });
  }
});

// GET /api/pricing/breakdown?roomTypeId=...&date=...
// Returns: { roomTypeId, date, price, breakdown }
router.get('/breakdown', async (req, res) => {
  try {
    const { roomTypeId, date } = req.query;

    if (!roomTypeId || !date) {
      return res.status(400).json({ 
        error: 'roomTypeId and date query parameters are required' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        error: 'Date must be in YYYY-MM-DD format' 
      });
    }

    const breakdown = await pricingService.getBreakdown(roomTypeId, date);

    if (breakdown.error) {
      return res.status(404).json(breakdown);
    }

    res.status(200).json(breakdown);
  } catch (error) {
    console.error('Error fetching price breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch price breakdown' });
  }
});

// Health check endpoint for pricing service
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    service: 'Pricing API',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
