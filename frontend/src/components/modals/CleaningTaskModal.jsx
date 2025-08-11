import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

export default function CleaningTaskModal({ 
  isOpen, 
  onClose, 
  task = null, 
  properties = [], 
  cleaners = [],
  onTaskSaved 
}) {
  const [taskFormData, setTaskFormData] = useState({
    property_id: '',
    room_unit_id: '',
    task_type: 'checkout',
    task_date: '',
    cleaner_id: '',
    special_notes: ''
  });
  const [roomUnits, setRoomUnits] = useState([]);
  const [loadingRoomUnits, setLoadingRoomUnits] = useState(false);

  // Initialize form data when modal opens or task changes
  useEffect(() => {
    if (isOpen) {
      if (task) {
        // Edit mode - populate form with task data
        setTaskFormData({
          property_id: task.property_id || '',
          room_unit_id: task.room_unit_id || '',
          task_type: task.task_type || 'checkout',
          task_date: task.task_date ? task.task_date.split('T')[0] : '',
          cleaner_id: task.cleaner_id || '',
          special_notes: task.special_notes || ''
        });
        
        // Load room units for the property
        if (task.property_id) {
          loadRoomUnits(task.property_id);
        }
      } else {
        // Create mode - reset form
        resetTaskForm();
      }
    }
  }, [isOpen, task]);

  const resetTaskForm = () => {
    setTaskFormData({
      property_id: '',
      room_unit_id: '',
      task_type: 'checkout',
      task_date: '',
      cleaner_id: '',
      special_notes: ''
    });
    setRoomUnits([]);
  };

  const loadRoomUnits = async (propertyId) => {
    if (!propertyId) {
      setRoomUnits([]);
      return;
    }

    try {
      setLoadingRoomUnits(true);
      console.log('Loading room units for property:', propertyId);
      
      const response = await adminAPI.getRoomTypes(propertyId, true);
      console.log('Room types response:', response.data);
      
      const allRoomUnits = [];
      
      // Check if we have roomTypes in the response
      if (response.data && response.data.roomTypes) {
        response.data.roomTypes.forEach(roomType => {
          console.log('Processing room type:', roomType);
          
          // Check if roomType has room_units (snake_case from backend)
          if (roomType.room_units && Array.isArray(roomType.room_units)) {
            roomType.room_units.forEach(unit => {
              allRoomUnits.push({
                id: unit.id,
                number: unit.unit_number || unit.number,
                roomTypeName: roomType.name,
                accessCode: unit.access_code,
                floorNumber: unit.floor_number
              });
            });
          }
          // Also check for camelCase version for backward compatibility
          else if (roomType.roomUnits && Array.isArray(roomType.roomUnits)) {
            roomType.roomUnits.forEach(unit => {
              allRoomUnits.push({
                id: unit.id,
                number: unit.unit_number || unit.number,
                roomTypeName: roomType.name,
                accessCode: unit.access_code,
                floorNumber: unit.floor_number
              });
            });
          }
        });
      }
      
      console.log('Processed room units:', allRoomUnits);
      setRoomUnits(allRoomUnits);
    } catch (error) {
      console.error('Error loading room units:', error);
      setRoomUnits([]);
    } finally {
      setLoadingRoomUnits(false);
    }
  };

  const handleFormChange = (field, value) => {
    setTaskFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Load room units when property changes
    if (field === 'property_id') {
      loadRoomUnits(value);
      setTaskFormData(prev => ({
        ...prev,
        room_unit_id: '' // Reset room unit selection
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Map frontend field names to backend expected field names
      const submitData = {
        propertyId: taskFormData.property_id,
        roomUnitId: taskFormData.room_unit_id,
        taskType: taskFormData.task_type,
        taskDate: taskFormData.task_date,
        cleanerId: taskFormData.cleaner_id || null,
        specialNotes: taskFormData.special_notes || null,
        reservationId: null // Make reservation ID nullable
      };

      if (task) {
        // Update existing task
        await adminAPI.updateCleaningTask(task.id, submitData);
      } else {
        // Create new task
        await adminAPI.createCleaningTask(submitData);
      }

      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      alert(`Failed to ${task ? 'update' : 'create'} task`);
    }
  };

  const handleClose = () => {
    resetTaskForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {task ? 'Edit Cleaning Task' : 'Create New Cleaning Task'}
            </h3>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Property Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property *
              </label>
              {task ? (
                <div className="input-field bg-gray-50 text-gray-600">
                  {task.property_name || 'Unknown Property'}
                </div>
              ) : (
                <select
                  value={taskFormData.property_id}
                  onChange={(e) => handleFormChange('property_id', e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Select a property</option>
                  {properties.map(property => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Room Unit Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Unit *
              </label>
              {task ? (
                <div className="input-field bg-gray-50 text-gray-600">
                  {task.room_unit_number || 'Unknown'} - {task.room_type_name || 'Standard Room'}
                  {task.room_floor_number && ` (Floor ${task.room_floor_number})`}
                </div>
              ) : (
                <select
                  value={taskFormData.room_unit_id}
                  onChange={(e) => handleFormChange('room_unit_id', e.target.value)}
                  className="input-field"
                  required
                  disabled={!taskFormData.property_id || loadingRoomUnits}
                >
                  <option value="">
                    {loadingRoomUnits ? 'Loading rooms...' : 'Select a room unit'}
                  </option>
                  {roomUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.number} - {unit.roomTypeName}
                      {unit.floorNumber && ` (Floor ${unit.floorNumber})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Task Type and Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Type *
                </label>
                <select
                  value={taskFormData.task_type}
                  onChange={(e) => handleFormChange('task_type', e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="checkout">Checkout</option>
                  <option value="eco">Eco</option>
                  <option value="request-high">Request High</option>
                  <option value="deep-clean">Deep Clean</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Date *
                </label>
                <input
                  type="date"
                  value={taskFormData.task_date}
                  onChange={(e) => handleFormChange('task_date', e.target.value)}
                  className="input-field"
                  required
                />
              </div>
            </div>

            {/* Cleaner Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign Cleaner
              </label>
              <select
                value={taskFormData.cleaner_id}
                onChange={(e) => handleFormChange('cleaner_id', e.target.value)}
                className="input-field"
              >
                <option value="">Assign later</option>
                {cleaners.map(cleaner => (
                  <option key={cleaner.id} value={cleaner.id}>
                    {cleaner.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Special Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Notes
              </label>
              <textarea
                value={taskFormData.special_notes}
                onChange={(e) => handleFormChange('special_notes', e.target.value)}
                className="input-field"
                rows="3"
                placeholder="Any special instructions or notes for this cleaning task..."
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!taskFormData.property_id || !taskFormData.room_unit_id || !taskFormData.task_date}
            >
              {task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
