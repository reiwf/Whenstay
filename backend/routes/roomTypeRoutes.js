const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { adminAuth } = require('../middleware/auth');

// All room type routes require admin authentication
router.use(adminAuth);

// GET /api/room-types/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('room_types')
      .select(`
        *,
        property:properties(name, currency),
        room_units(id, unit_number, is_active)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Room type not found' });
      }
      throw error;
    }

    res.status(200).json({
      message: 'Room type retrieved successfully',
      room_type: data
    });
  } catch (error) {
    console.error('Error fetching room type:', error);
    res.status(500).json({ error: 'Failed to fetch room type' });
  }
});

// GET /api/room-types
router.get('/', async (req, res) => {
  try {
    const { property_id } = req.query;
    
    let query = supabaseAdmin
      .from('room_types')
      .select(`
        *,
        property:properties(name, currency),
        room_units(id, unit_number, is_active)
      `)
      .eq('is_active', true);

    if (property_id) {
      query = query.eq('property_id', property_id);
    }

    const { data, error } = await query.order('sort_order', { ascending: true }).order('name');

    if (error) {
      throw error;
    }

    res.status(200).json({
      message: 'Room types retrieved successfully',
      room_types: data || []
    });
  } catch (error) {
    console.error('Error fetching room types:', error);
    res.status(500).json({ error: 'Failed to fetch room types' });
  }
});

// PUT /api/room-types/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('room_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Room type not found' });
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Room type updated successfully',
      room_type: data
    });
  } catch (error) {
    console.error('Error updating room type:', error);
    res.status(500).json({ error: 'Failed to update room type' });
  }
});

module.exports = router;
