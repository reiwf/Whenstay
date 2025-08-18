import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  Home,
  Check,
  AlertTriangle
} from 'lucide-react';
import { DateUtils } from './CalendarUtils';

/**
 * GapFillModal - Smart allocation interface for placing reservations across multiple rooms
 * Handles gap-fill allocation with conflict resolution and room swaps
 */
export default function GapFillModal({
  isOpen,
  onClose,
  onAllocate,
  availableRooms = [],
  defaultStartDate = null,
  defaultEndDate = null,
  loading = false
}) {
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    checkInDate: defaultStartDate || DateUtils.addDays(new Date().toISOString().split('T')[0], 1),
    checkOutDate: defaultEndDate || DateUtils.addDays(new Date().toISOString().split('T')[0], 3),
    numGuests: 1,
    allowSwaps: true
  });
  
  const [selectedRooms, setSelectedRooms] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        guestName: '',
        guestEmail: '',
        checkInDate: defaultStartDate || DateUtils.addDays(new Date().toISOString().split('T')[0], 1),
        checkOutDate: defaultEndDate || DateUtils.addDays(new Date().toISOString().split('T')[0], 3),
        numGuests: 1,
        allowSwaps: true
      });
      setSelectedRooms(new Set());
      setErrors({});
    }
  }, [isOpen, defaultStartDate, defaultEndDate]);

  // Auto-select all rooms if none selected and rooms are available
  useEffect(() => {
    if (availableRooms.length > 0 && selectedRooms.size === 0) {
      const allRoomIds = availableRooms.flatMap(roomType => 
        roomType.room_units?.map(unit => unit.id) || []
      );
      setSelectedRooms(new Set(allRoomIds));
    }
  }, [availableRooms]);

  /**
   * Handle form field changes
   */
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear field-specific error
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  /**
   * Handle room selection toggle
   */
  const handleRoomToggle = (roomId) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    setSelectedRooms(newSelected);
  };

  /**
   * Handle room type toggle (select/deselect all units in type)
   */
  const handleRoomTypeToggle = (roomType) => {
    const roomIds = roomType.room_units?.map(unit => unit.id) || [];
    const allSelected = roomIds.every(id => selectedRooms.has(id));
    
    const newSelected = new Set(selectedRooms);
    if (allSelected) {
      // Deselect all units in this room type
      roomIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all units in this room type
      roomIds.forEach(id => newSelected.add(id));
    }
    setSelectedRooms(newSelected);
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.guestName.trim()) {
      newErrors.guestName = 'Guest name is required';
    }

    if (!formData.checkInDate) {
      newErrors.checkInDate = 'Check-in date is required';
    }

    if (!formData.checkOutDate) {
      newErrors.checkOutDate = 'Check-out date is required';
    }

    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      
      if (checkOut <= checkIn) {
        newErrors.checkOutDate = 'Check-out date must be after check-in date';
      }
      
      const nightsDiff = DateUtils.daysBetween(formData.checkInDate, formData.checkOutDate);
      if (nightsDiff > 30) {
        newErrors.checkOutDate = 'Stay cannot exceed 30 nights';
      }
    }

    if (selectedRooms.size === 0) {
      newErrors.rooms = 'Select at least one room for allocation';
    }

    if (formData.numGuests < 1 || formData.numGuests > 20) {
      newErrors.numGuests = 'Number of guests must be between 1 and 20';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      
      const allocationData = {
        guestName: formData.guestName.trim(),
        guestEmail: formData.guestEmail.trim() || undefined,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        roomUnitIds: Array.from(selectedRooms),
        allowSwaps: formData.allowSwaps,
        numGuests: formData.numGuests
      };

      await onAllocate(allocationData);
      onClose();
    } catch (error) {
      console.error('Allocation error:', error);
      setErrors({ submit: error.message || 'Failed to allocate reservation' });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Calculate nights and display summary
   */
  const getNightsSummary = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return '';
    
    const nights = DateUtils.daysBetween(formData.checkInDate, formData.checkOutDate);
    return `${nights} night${nights !== 1 ? 's' : ''}`;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Smart Room Allocation
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-4 pb-4 sm:px-6">
              {/* Guest Information */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    Guest Name *
                  </label>
                  <input
                    type="text"
                    value={formData.guestName}
                    onChange={(e) => handleInputChange('guestName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.guestName ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter guest name"
                  />
                  {errors.guestName && (
                    <p className="mt-1 text-xs text-red-600">{errors.guestName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guest Email
                  </label>
                  <input
                    type="email"
                    value={formData.guestEmail}
                    onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="guest@example.com"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Check-in Date *
                    </label>
                    <input
                      type="date"
                      value={formData.checkInDate}
                      onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.checkInDate ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.checkInDate && (
                      <p className="mt-1 text-xs text-red-600">{errors.checkInDate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check-out Date *
                    </label>
                    <input
                      type="date"
                      value={formData.checkOutDate}
                      onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.checkOutDate ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.checkOutDate && (
                      <p className="mt-1 text-xs text-red-600">{errors.checkOutDate}</p>
                    )}
                  </div>
                </div>

                {/* Stay Summary */}
                {formData.checkInDate && formData.checkOutDate && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <div className="text-sm text-blue-800">
                      <strong>{getNightsSummary()}</strong> from {DateUtils.formatDate(formData.checkInDate, 'long')} to {DateUtils.formatDate(formData.checkOutDate, 'long')}
                    </div>
                  </div>
                )}

                {/* Guests */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Guests
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.numGuests}
                    onChange={(e) => handleInputChange('numGuests', parseInt(e.target.value) || 1)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.numGuests ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.numGuests && (
                    <p className="mt-1 text-xs text-red-600">{errors.numGuests}</p>
                  )}
                </div>

                {/* Room Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Home className="w-4 h-4 inline mr-1" />
                    Available Rooms *
                  </label>
                  
                  {availableRooms.length === 0 ? (
                    <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                      No rooms available for this property
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                      {availableRooms.map((roomType) => (
                        <div key={roomType.room_type_id} className="border-b border-gray-200 last:border-b-0">
                          {/* Room Type Header */}
                          <div 
                            className="bg-gray-50 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                            onClick={() => handleRoomTypeToggle(roomType)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-gray-900">
                                {roomType.room_type_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {roomType.room_units?.length || 0} units
                              </div>
                            </div>
                          </div>

                          {/* Room Units */}
                          {roomType.room_units?.map((unit) => {
                            const isSelected = selectedRooms.has(unit.id);
                            
                            return (
                              <label
                                key={unit.id}
                                className="flex items-center px-6 py-2 hover:bg-gray-25 cursor-pointer transition-colors duration-150"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleRoomToggle(unit.id)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-3 text-sm text-gray-700">
                                  Room {unit.unit_number}
                                  {unit.floor_number && (
                                    <span className="text-gray-500 ml-1">
                                      (Floor {unit.floor_number})
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {errors.rooms && (
                    <p className="mt-1 text-xs text-red-600">{errors.rooms}</p>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Selected {selectedRooms.size} room{selectedRooms.size !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.allowSwaps}
                      onChange={(e) => handleInputChange('allowSwaps', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Allow room swaps to resolve conflicts
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    When enabled, existing reservations may be moved to compatible rooms to accommodate this booking
                  </p>
                </div>

                {/* Submit Error */}
                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex">
                      <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
                      <div className="text-sm text-red-700">{errors.submit}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={submitting || loading}
                className={`
                  w-full inline-flex justify-center rounded-md border border-transparent shadow-sm 
                  px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 
                  focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm
                  transition-colors duration-150
                  ${submitting || loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                  }
                `}
              >
                {submitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Allocating...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2" />
                    Allocate Rooms
                  </div>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors duration-150 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * GapFillModal component for smart allocation
 */
GapFillModal.displayName = 'GapFillModal';
