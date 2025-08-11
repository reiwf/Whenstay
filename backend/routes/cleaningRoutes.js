const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');
const { adminAuth } = require('../middleware/auth');

// Get cleaning tasks
router.get('/tasks', adminAuth, async (req, res) => {
  try {
    const { 
      propertyId, 
      cleanerId, 
      taskDate, 
      taskDateFrom, 
      taskDateTo, 
      status, 
      includeCancelled,
      limit,
      offset,
      sortBy,
      sortOrder
    } = req.query;
    
    const filters = { 
      propertyId, 
      cleanerId, 
      taskDate, 
      taskDateFrom, 
      taskDateTo, 
      status, 
      includeCancelled: includeCancelled === 'true',
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      sortBy,
      sortOrder
    };

    const tasks = await reservationService.getCleaningTasks(filters);

    res.status(200).json({
      message: 'Cleaning tasks retrieved successfully',
      tasks
    });
  } catch (error) {
    console.error('Error fetching cleaning tasks:', error);
    res.status(500).json({ error: 'Failed to fetch cleaning tasks' });
  }
});

// Create cleaning task
router.post('/tasks', adminAuth, async (req, res) => {
  try {
    const {
      propertyId,
      cleanerId,
      reservationId,
      taskDate,
      taskType,
      status,
      priority,
      estimatedDuration,
      specialNotes
    } = req.body;

    const taskData = {
      propertyId,
      cleanerId,
      reservationId,
      taskDate,
      taskType: taskType || 'checkout',
      status: status || 'pending',
      priority: priority || 'normal',
      estimatedDuration,
      specialNotes
    };

    const task = await reservationService.createCleaningTask(taskData);

    res.status(201).json({
      message: 'Cleaning task created successfully',
      task
    });
  } catch (error) {
    console.error('Error creating cleaning task:', error);
    res.status(500).json({ error: 'Failed to create cleaning task' });
  }
});

// Update cleaning task
router.put('/tasks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const task = await reservationService.updateCleaningTask(id, updateData);

    res.status(200).json({
      message: 'Cleaning task updated successfully',
      task
    });
  } catch (error) {
    console.error('Error updating cleaning task:', error);
    res.status(500).json({ error: 'Failed to update cleaning task' });
  }
});

// Delete cleaning task
router.delete('/tasks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const task = await reservationService.deleteCleaningTask(id);

    res.status(200).json({
      message: 'Cleaning task deleted successfully',
      task
    });
  } catch (error) {
    console.error('Error deleting cleaning task:', error);
    res.status(500).json({ error: 'Failed to delete cleaning task' });
  }
});

// Assign cleaner to task
router.patch('/tasks/:id/assign', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cleanerId } = req.body;

    if (!cleanerId) {
      return res.status(400).json({ error: 'Cleaner ID is required' });
    }

    const task = await reservationService.assignCleanerToTask(id, cleanerId);

    res.status(200).json({
      message: 'Cleaner assigned to task successfully',
      task
    });
  } catch (error) {
    console.error('Error assigning cleaner to task:', error);
    res.status(500).json({ error: 'Failed to assign cleaner to task' });
  }
});

// Get available cleaners
router.get('/cleaners', adminAuth, async (req, res) => {
  try {
    const cleaners = await reservationService.getAvailableCleaners();

    res.status(200).json({
      message: 'Available cleaners retrieved successfully',
      cleaners
    });
  } catch (error) {
    console.error('Error fetching available cleaners:', error);
    res.status(500).json({ error: 'Failed to fetch available cleaners' });
  }
});

// Cleaning task statistics
router.get('/tasks/stats', adminAuth, async (req, res) => {
  try {
    const { propertyId, cleanerId, taskDate, taskDateFrom, taskDateTo } = req.query;
    const filters = { propertyId, cleanerId, taskDate, taskDateFrom, taskDateTo };

    const stats = await reservationService.getCleaningTaskStats(filters);

    res.status(200).json({
      message: 'Cleaning task statistics retrieved successfully',
      stats
    });
  } catch (error) {
    console.error('Error fetching cleaning task stats:', error);
    res.status(500).json({ error: 'Failed to fetch cleaning task statistics' });
  }
});

module.exports = router;
