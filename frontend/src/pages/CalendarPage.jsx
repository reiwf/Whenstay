import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import PropertySelector from '../components/calendar/PropertySelector';
import CalendarTimeline from '../components/calendar/CalendarTimeline';

/**
 * Integrates property selection with calendar timeline
 */
export default function CalendarPage() {
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Initialize page
  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  /**
   * Handle property selection change
   */
  const handlePropertyChange = (propertyId) => {
    setSelectedPropertyId(propertyId);
  };

  if (pageLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-lg">Loading Calendar...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        {/* <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Calendar Timeline</h1>
              <p className="text-gray-600">Manage reservations across rooms and dates</p>
            </div>
          </div>
        </div> */}

        {/* Property Selector */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="w-80">
              <PropertySelector
                selectedPropertyId={selectedPropertyId}
                onPropertyChange={handlePropertyChange}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Calendar Timeline */}
        <div className="min-h-screen">
          <CalendarTimeline
            propertyId={selectedPropertyId}
            onPropertyChange={handlePropertyChange}
            className="w-full"
          />
        </div>

        {/* Instructions Card */}
        {selectedPropertyId && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Calendar Instructions</h3>
            <div className="text-sm text-blue-800 space-y-1">
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/**
 * Calendar page component
 */
CalendarPage.displayName = 'CalendarPage';
