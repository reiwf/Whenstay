import React from 'react';
import { Bed, Plus, DollarSign } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

export default function RoomTypeList({ 
  roomTypes = [], 
  selectedRoomType, 
  onRoomTypeSelect, 
  loading = false,
  className = '' 
}) {
  
  const formatPrice = (price, currency = 'JPY') => {
    if (!price) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(price);
  };

  const getRoomTypeStats = (roomType) => {
    const activeUnits = roomType.room_units?.filter(unit => unit.is_active)?.length || 0;
    return {
      units: activeUnits,
      hasPrice: roomType.base_price > 0
    };
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="small" className="mr-2" />
          <span className="text-sm text-gray-500">Loading room types...</span>
        </div>
      </div>
    );
  }

  if (roomTypes.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-8 text-gray-500">
          <Bed className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">No room types</h3>
          <p className="text-xs">Create room types in the property page first</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {roomTypes.map((roomType) => {
        const stats = getRoomTypeStats(roomType);
        const isSelected = selectedRoomType?.id === roomType.id;
        
        return (
          <button
            key={roomType.id}
            onClick={() => onRoomTypeSelect(roomType)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              isSelected
                ? 'border-primary-500 bg-primary-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bed className={`w-4 h-4 ${isSelected ? 'text-primary-600' : 'text-gray-500'}`} />
                <h4 className={`text-sm font-medium truncate ${
                  isSelected ? 'text-primary-900' : 'text-gray-900'
                }`}>
                  {roomType.name}
                </h4>
              </div>
              
              {stats.hasPrice && (
                <DollarSign className={`w-3 h-3 ${isSelected ? 'text-primary-500' : 'text-gray-400'}`} />
              )}
            </div>
            
            <div className="space-y-1">
              {/* Basic info */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Max guests:</span>
                <span className={isSelected ? 'text-primary-700' : 'text-gray-600'}>
                  {roomType.max_guests || 2}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Units:</span>
                <span className={isSelected ? 'text-primary-700' : 'text-gray-600'}>
                  {stats.units}
                </span>
              </div>
              
              {/* Pricing info */}
              {roomType.base_price && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Base price:</span>
                  <span className={`font-medium ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>
                    {formatPrice(roomType.base_price, roomType.currency)}
                  </span>
                </div>
              )}
              
              {/* Price range */}
              {(roomType.min_price || roomType.max_price) && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Range:</span>
                  <span className={`text-xs ${isSelected ? 'text-primary-600' : 'text-gray-500'}`}>
                    {formatPrice(roomType.min_price, roomType.currency)} - {formatPrice(roomType.max_price, roomType.currency)}
                  </span>
                </div>
              )}
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center gap-2 mt-2">
              {!roomType.is_active && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                  Inactive
                </span>
              )}
              {!stats.hasPrice && (
                <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
                  No pricing
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
