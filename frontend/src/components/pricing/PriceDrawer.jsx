import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function PriceDrawer({ data, onClose, onSave, formatPrice, currency }) {
  const [price, setPrice] = useState(0);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.price) {
      setPrice(Math.round(data.price));
    }
  }, [data]);

  const [priceAdjustment, setPriceAdjustment] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setPriceAdjustment(null);
    try {
      const result = await onSave(price, locked);
      // Handle price adjustment notification
      if (result?.price_adjusted) {
        setPriceAdjustment({
          original: result.original_price,
          clamped: result.clamped_price,
          bounds: result.room_bounds,
          message: result.message
        });
        setPrice(result.clamped_price);
      }
    } catch (error) {
      console.error('Error saving override:', error);
    } finally {
      setSaving(false);
    }
  };

  const b = data?.breakdown || {};
  const hasBreakdown = !!data?.breakdown;

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50">
      <div className="w-[420px] h-full bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pricing Details</h2>
            <p className="text-sm text-gray-500">{data?.date}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Price */}
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {formatPrice(price)}
            </div>
            <div className="text-sm text-gray-500">Current price for this date</div>
          </div>

          {/* Price Override Controls */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900">Override Price</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Set Custom Price ({currency})
                </label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="100"
                  className="w-full"
                />
              </div>
              
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Lock this date (prevent auto-recalculation)</span>
              </label>
            </div>
            
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-black text-white hover:bg-gray-800"
            >
              {saving ? 'Saving...' : 'Save Override'}
            </Button>
          </div>

          {/* Price Adjustment Notification */}
          {priceAdjustment && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 mb-2">
                <span className="text-sm">⚠️</span>
                <span className="font-medium text-sm">Price Adjusted</span>
              </div>
              <div className="text-amber-700 text-sm space-y-1">
                <p>Your price of {formatPrice(priceAdjustment.original)} was adjusted to {formatPrice(priceAdjustment.clamped)}</p>
                <p className="text-xs">
                  Room bounds: {formatPrice(priceAdjustment.bounds?.min)} - {formatPrice(priceAdjustment.bounds?.max)}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {data?.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{data.error}</p>
            </div>
          )}

          {/* Price Breakdown */}
          {hasBreakdown && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">
                Why This Price? 🤔
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600">Base Price:</span>
                  <span className="font-medium">{formatPrice(b.basePrice)}</span>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600">× Seasonality:</span>
                  <span className="font-mono text-sm">{b.seasonality?.toFixed(3) || '1.000'}</span>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600">× Day of Week:</span>
                  <span className="font-mono text-sm">{b.dow?.toFixed(3) || '1.000'}</span>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600">× Lead Time:</span>
                  <span className="font-mono text-sm">{b.leadTime?.toFixed(3) || '1.000'}</span>
                </div>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600">× Length of Stay:</span>
                  <span className="font-mono text-sm">{b.los?.toFixed(3) || '1.000'}</span>
                </div>
                
                {/* Smart Market Demand Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1 bg-green-50 px-2 rounded">
                    <span className="text-gray-600 font-medium">× Market Demand:</span>
                    <span className="font-mono text-sm font-medium text-green-700">{b.demand?.toFixed(3) || '1.000'}</span>
                  </div>
                  
                  {/* Smart Market Demand Details - show if available */}
                  {(b.pickup_signal !== undefined || b.availability_signal !== undefined || b.events_weight !== undefined || b.competitor_gap !== undefined) && (
                    <div className="ml-4 pl-3 border-l-2 border-green-200 space-y-1 text-xs">
                      {b.pickup_signal !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">📈 Pickup pace:</span>
                          <span className="font-mono text-gray-600">{b.pickup_signal?.toFixed(3)}</span>
                        </div>
                      )}
                      {b.availability_signal !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">🏠 Availability pressure:</span>
                          <span className="font-mono text-gray-600">{b.availability_signal?.toFixed(3)}</span>
                        </div>
                      )}
                      {b.events_weight !== undefined && b.events_weight !== 1 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">🎉 Events impact:</span>
                          <span className="font-mono text-gray-600">×{b.events_weight?.toFixed(3)}</span>
                        </div>
                      )}
                      {b.competitor_gap !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">⚔️ Competitor gap:</span>
                          <span className="font-mono text-gray-600">{b.competitor_gap > 0 ? '+' : ''}{(b.competitor_gap * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {b.is_locked && (
                        <div className="flex items-center text-amber-600 mt-1">
                          <span className="text-xs">🔒 Manual override active</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center py-1 bg-blue-50 px-2 rounded">
                  <span className="text-gray-600">
                    × Occupancy ({b.occupancyPct?.toFixed(1) || '0.0'}%):
                  </span>
                  <span className="font-mono text-sm font-medium text-blue-700">
                    {b.occupancy?.toFixed(3) || '1.000'}
                  </span>
                </div>
                
                {b.daysOut !== undefined && (
                  <div className="text-xs text-gray-500 px-2">
                    Lead time: {b.daysOut} days out
                  </div>
                )}
                
                {b.orphan && b.orphan !== 1 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-600">× Orphan Gap:</span>
                    <span className="font-mono text-sm">{b.orphan?.toFixed(3)}</span>
                  </div>
                )}
                
                <hr className="my-2" />
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-600">Unclamped Result:</span>
                  <span className="font-medium">{formatPrice(b.unclamped)}</span>
                </div>
                
                <div className="flex justify-between items-center py-1 text-xs text-gray-500">
                  <span>Min-Max Range:</span>
                  <span>{formatPrice(b.minPrice)} – {formatPrice(b.maxPrice)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 bg-gray-100 px-2 rounded font-medium">
                  <span>Final Price:</span>
                  <span className="text-lg">{formatPrice(b.basePrice * (b.seasonality || 1) * (b.dow || 1) * (b.leadTime || 1) * (b.los || 1) * (b.demand || 1) * (b.occupancy || 1) * (b.orphan || 1))}</span>
                </div>
              </div>
              
              {/* Occupancy Explanation */}
              {b.occupancyPct !== undefined && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                  <div className="font-medium text-blue-900 mb-1">
                    📊 Occupancy Impact
                  </div>
                  <div className="text-blue-700">
                    {b.occupancyPct}% of available units are booked for this date.
                    {b.daysOut && ` With ${b.daysOut} days advance notice, `}
                    The occupancy factor is {b.occupancy?.toFixed(3)} 
                    ({b.occupancyPercent > 0 ? '+' : ''}{b.occupancyPercent}% adjustment).
                  </div>
                </div>
              )}
              
              {/* Calculation Formula */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-600">
                <div className="font-medium text-gray-700 mb-1">Formula:</div>
                price = clamp(base × factors, min, max)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
