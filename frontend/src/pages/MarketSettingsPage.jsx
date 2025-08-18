import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Settings, 
  Target, 
  BarChart3,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import LoadingSpinner from '../components/LoadingSpinner';
import api, { adminAPI, marketDemandAPI } from '../services/api';

const MarketSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Data states
  const [overview, setOverview] = useState({});
  const [competitors, setCompetitors] = useState([]);
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [tuning, setTuning] = useState({});
  const [seasonality, setSeasonality] = useState([]);

  // Form states
  const [newCompetitor, setNewCompetitor] = useState({ label: '', property_type: 'hotel' });
  const [newEvent, setNewEvent] = useState({ 
    title: '', 
    start_date: '', 
    end_date: '', 
    weight: 1.10, 
    description: '' 
  });
  const [priceInput, setPriceInput] = useState({ date: '', prices: '' });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'competitors', label: 'Competitors', icon: Users },
    { id: 'events', label: 'Events & Holidays', icon: Calendar },
    { id: 'tuning', label: 'Market Tuning', icon: Settings },
    { id: 'seasonality', label: 'Seasonality', icon: TrendingUp },
    { id: 'overrides', label: 'Manual Overrides', icon: Target }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overview':
          await loadOverview();
          break;
        case 'competitors':
          await loadCompetitors();
          break;
        case 'events':
          await loadEventsAndHolidays();
          break;
        case 'tuning':
          await loadTuning();
          break;
        case 'seasonality':
          await loadSeasonality();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async () => {
    try {
      const competitorSummary = await api.get('/market-demand/competitors/null/summary').catch(err => {
        if (err.response?.status === 500) {
          throw new Error('TABLES_NOT_CREATED');
        }
        throw err;
      });

      setOverview({
        competitor_summary: competitorSummary.data,
        last_calculation: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error loading overview:', error);
      if (error.message === 'TABLES_NOT_CREATED') {
        setOverview({
          tables_missing: true,
          error: 'Database tables for smart market demand have not been created yet.'
        });
      }
    }
  };

  const triggerCalculateFactors = async () => {
    setLoading(true);
    setMessage({ type: 'info', text: 'Starting market factor calculation... This may take up to 2 minutes.' });
    
    try {
      await marketDemandAPI.triggerCalculateFactors();
      setMessage({ 
        type: 'success', 
        text: 'Market factor calculation completed successfully! Performance has been optimized.' 
      });
      // Reload overview data after calculation
      await loadOverview();
    } catch (error) {
      console.error('Error triggering factor calculation:', error);
      let errorMessage = 'Failed to trigger market factor calculation';
      
      // Provide more specific error messages based on the error type
      if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
        errorMessage = 'Calculation is taking longer than expected. Please check the system logs and try again.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error during calculation. Please check that the database migration has been run.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const loadCompetitors = async () => {
    try {
      const response = await api.get('/market-demand/competitors/null');
      setCompetitors(response.data || []);
    } catch (error) {
      console.error('Error loading competitors:', error);
      setCompetitors([]);
      if (error.response?.status === 500) {
        setMessage({ 
          type: 'error', 
          text: 'Database tables not found. Please run the smart_market_demand_migration.sql file first.' 
        });
      }
    }
  };

  const loadEventsAndHolidays = async () => {
    try {
      const [eventsResponse, holidaysResponse] = await Promise.all([
        api.get('/market-demand/events/null').catch(err => {
          console.error('Error loading events:', err);
          return { data: [] };
        }),
        api.get('/market-demand/holidays/null').catch(err => {
          console.error('Error loading holidays:', err);
          return { data: [] };
        })
      ]);
      setEvents(eventsResponse.data || []);
      setHolidays(holidaysResponse.data || []);
    } catch (error) {
      console.error('Error loading events and holidays:', error);
      setEvents([]);
      setHolidays([]);
      setMessage({ 
        type: 'error', 
        text: 'Some data could not be loaded. Please check backend logs for database issues.' 
      });
    }
  };

  const loadTuning = async () => {
    try {
      const response = await api.get('/market-demand/tuning/null');
      setTuning(response.data || {});
    } catch (error) {
      console.error('Error loading tuning:', error);
      // Set default tuning values
      setTuning({
        w_pickup: 0.4,
        w_avail: 0.3,
        w_event: 0.3,
        alpha: 0.12,
        beta: 0.10,
        demand_min: 0.80,
        demand_max: 1.40
      });
      if (error.response?.status === 500) {
        setMessage({ 
          type: 'error', 
          text: 'Database tables not found. Please run the smart_market_demand_migration.sql file first.' 
        });
      }
    }
  };

  const loadSeasonality = async () => {
    try {
      const response = await api.get('/market-demand/seasonality/null');
      setSeasonality(response.data || []);
    } catch (error) {
      console.error('Error loading seasonality:', error);
      // Don't set default values automatically - let the user manage their own seasonality settings
      setSeasonality([]);
      if (error.response?.status === 500) {
        setMessage({ 
          type: 'error', 
          text: 'Database tables not found. Please run the seasonality_settings_migration.sql file first.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: 'Failed to load seasonality settings. Please check your connection and try again.' 
        });
      }
    }
  };

  const handleSaveSeasonality = async () => {
    setSaving(true);
    try {
      await api.put('/market-demand/seasonality/null', { settings: seasonality });
      setMessage({ type: 'success', text: 'Seasonality settings saved successfully' });
    } catch (error) {
      console.error('Error saving seasonality:', error);
      setMessage({ type: 'error', text: 'Failed to save seasonality settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSeasonality = async () => {
    setSaving(true);
    try {
      await api.post('/market-demand/seasonality/null/reset');
      await loadSeasonality(); // Reload the default settings
      setMessage({ type: 'success', text: 'Seasonality settings reset to defaults' });
    } catch (error) {
      console.error('Error resetting seasonality:', error);
      setMessage({ type: 'error', text: 'Failed to reset seasonality settings' });
    } finally {
      setSaving(false);
    }
  };

  const addSeason = () => {
    const currentYear = new Date().getFullYear();
    setSeasonality([...seasonality, {
      season_name: 'New Season',
      start_date: `${currentYear}-01-01`,
      end_date: `${currentYear}-03-31`,
      multiplier: 1.0,
      year_recurring: true
    }]);
  };

  const updateSeason = (index, field, value) => {
    const updated = [...seasonality];
    updated[index] = { ...updated[index], [field]: value };
    setSeasonality(updated);
  };

  const removeSeason = (index) => {
    const updatedSeasons = seasonality.filter((_, i) => i !== index);
    setSeasonality(updatedSeasons);
    console.log('Removed season at index:', index, 'New length:', updatedSeasons.length);
  };

  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const isDateInSeason = (checkDate, season) => {
    if (!season.year_recurring) {
      // Non-recurring: exact date range match
      return checkDate >= new Date(season.start_date) && checkDate <= new Date(season.end_date);
    }

    // Recurring: check if the date falls within the annual pattern
    const checkMonth = checkDate.getMonth() + 1;
    const checkDay = checkDate.getDate();
    const startDate = new Date(season.start_date);
    const endDate = new Date(season.end_date);
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();

    // Create comparable date values (MMDD format)
    const checkValue = checkMonth * 100 + checkDay;
    const startValue = startMonth * 100 + startDay;
    const endValue = endMonth * 100 + endDay;

    if (startValue <= endValue) {
      // Normal range (e.g., Spring: Mar 1 - May 31)
      return checkValue >= startValue && checkValue <= endValue;
    } else {
      // Wrap-around range (e.g., Winter: Dec 1 - Feb 28)
      return checkValue >= startValue || checkValue <= endValue;
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitor.label) return;
    
    setSaving(true);
    try {
      const compSet = competitors[0];
      if (!compSet) {
        // Create default competitor set first
        const setResponse = await api.post('/market-demand/competitors/null/sets', {
          name: 'Default',
          description: 'Default competitor set'
        });
        
        await api.post(`/market-demand/competitors/sets/${setResponse.data.id}/members`, {
          ...newCompetitor,
          source: 'manual'
        });
      } else {
        await api.post(`/market-demand/competitors/sets/${compSet.id}/members`, {
          ...newCompetitor,
          source: 'manual'
        });
      }

      setNewCompetitor({ label: '', property_type: 'hotel' });
      setMessage({ type: 'success', text: 'Competitor added successfully' });
      loadCompetitors();
    } catch (error) {
      console.error('Error adding competitor:', error);
      setMessage({ type: 'error', text: 'Failed to add competitor' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.start_date || !newEvent.end_date) return;
    
    setSaving(true);
    try {
      await api.post('/market-demand/events', {
        ...newEvent,
        location_id: null
      });

      setNewEvent({ title: '', start_date: '', end_date: '', weight: 1.10, description: '' });
      setMessage({ type: 'success', text: 'Event added successfully' });
      loadEventsAndHolidays();
    } catch (error) {
      console.error('Error adding event:', error);
      setMessage({ type: 'error', text: 'Failed to add event' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputPrices = async () => {
    if (!priceInput.date || !priceInput.prices) return;
    
    setSaving(true);
    try {
      const prices = priceInput.prices.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p) && p > 0);
      if (prices.length === 0) {
        setMessage({ type: 'error', text: 'Please enter valid prices separated by commas' });
        return;
      }

      const compSet = competitors[0];
      if (!compSet) {
        setMessage({ type: 'error', text: 'Please add competitors first' });
        return;
      }

      await api.post(`/market-demand/competitors/sets/${compSet.id}/prices`, {
        date: priceInput.date,
        prices: prices
      });

      setPriceInput({ date: '', prices: '' });
      setMessage({ type: 'success', text: `Added ${prices.length} competitor prices for ${priceInput.date}` });
    } catch (error) {
      console.error('Error inputting prices:', error);
      setMessage({ type: 'error', text: 'Failed to input prices' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTuning = async () => {
    setSaving(true);
    try {
      await api.put('/market-demand/tuning/null', tuning);
      setMessage({ type: 'success', text: 'Tuning parameters saved successfully' });
    } catch (error) {
      console.error('Error saving tuning:', error);
      setMessage({ type: 'error', text: 'Failed to save tuning parameters' });
    } finally {
      setSaving(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
     
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Competitor Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.competitor_summary?.active_competitors || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {overview.competitor_summary?.recent_price_data || 0} recent price entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Smart Calculations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Daily at 2 AM JST
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Market Factors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-blue-600">
              Enhanced Active
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Pickup, availability, events, competitors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={() => setActiveTab('competitors')}
              variant="outline"
              className="justify-start"
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Competitors
            </Button>
            <Button 
              onClick={() => setActiveTab('events')}
              variant="outline"
              className="justify-start"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Add Events
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={loadOverview}
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Market Data
            </Button>
            <Button
              onClick={triggerCalculateFactors}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <TrendingUp className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Calculate Market Factors
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCompetitors = () => (
    <div className="space-y-6">
      {/* Add Competitor */}
      <Card>
        <CardHeader>
          <CardTitle>Add Competitor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Competitor Name</label>
              <Input
                value={newCompetitor.label}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, label: e.target.value })}
                placeholder="e.g., Hotel Sakura"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Property Type</label>
              <select
                value={newCompetitor.property_type}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, property_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="hotel">Hotel</option>
                <option value="apartment">Apartment</option>
                <option value="hostel">Hostel</option>
                <option value="ryokan">Ryokan</option>
              </select>
            </div>
          </div>
          <Button onClick={handleAddCompetitor} disabled={saving}>
            <Plus className="w-4 h-4 mr-2" />
            Add Competitor
          </Button>
        </CardContent>
      </Card>

      {/* Competitor List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Competitors</CardTitle>
        </CardHeader>
        <CardContent>
          {competitors.length > 0 ? (
            <div className="space-y-2">
              {competitors.map(set => (
                set.comp_members?.map(comp => (
                  <div key={comp.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{comp.label}</div>
                      <div className="text-sm text-gray-500">
                        {comp.property_type} • Added {new Date(comp.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={comp.is_active ? "default" : "secondary"}>
                      {comp.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No competitors added yet</p>
          )}
        </CardContent>
      </Card>

      {/* Price Input */}
      {competitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Input Competitor Prices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <Input
                  type="date"
                  value={priceInput.date}
                  onChange={(e) => setPriceInput({ ...priceInput, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Prices (comma-separated)</label>
                <Input
                  value={priceInput.prices}
                  onChange={(e) => setPriceInput({ ...priceInput, prices: e.target.value })}
                  placeholder="15000, 18000, 12000"
                />
              </div>
            </div>
            <Button onClick={handleInputPrices} disabled={saving}>
              Add Prices
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderEvents = () => (
    <div className="space-y-6">
      {/* Add Event */}
      <Card>
        <CardHeader>
          <CardTitle>Add Event</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Event Title</label>
              <Input
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="e.g., Tokyo Marathon"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Impact Weight</label>
              <Input
                type="number"
                step="0.01"
                min="1.0"
                max="2.0"
                value={newEvent.weight}
                onChange={(e) => setNewEvent({ ...newEvent, weight: parseFloat(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <Input
                type="date"
                value={newEvent.start_date}
                onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <Input
                type="date"
                value={newEvent.end_date}
                onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Optional description"
            />
          </div>
          <Button onClick={handleAddEvent} disabled={saving}>
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                      </div>
                      {event.description && (
                        <div className="text-sm text-gray-600 mt-1">{event.description}</div>
                      )}
                    </div>
                    <Badge>×{event.weight}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No events added yet</p>
          )}
        </CardContent>
      </Card>

      {/* Holidays */}
      <Card>
        <CardHeader>
          <CardTitle>System Holidays</CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length > 0 ? (
            <div className="space-y-2">
              {holidays.slice(0, 10).map(holiday => (
                <div key={holiday.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium">{holiday.title}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {new Date(holiday.dt).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge>×{holiday.weight}</Badge>
                </div>
              ))}
              {holidays.length > 10 && (
                <p className="text-sm text-gray-500 text-center">
                  ...and {holidays.length - 10} more holidays
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No holidays loaded</p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderTuning = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Market Demand Formula Weights</CardTitle>
          <p className="text-sm text-gray-600">
            Configure how different signals affect demand calculations
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Weight Parameters */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-800">Signal Weights</h3>
            
            {/* Pickup Pace Weight */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Pickup Pace Weight</label>
                <span className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {(tuning.w_pickup || 0.4).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tuning.w_pickup || 0.4}
                onChange={(e) => setTuning({ ...tuning, w_pickup: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider pickup-weight"
              />
              <p className="text-xs text-gray-500">Recent booking activity impact (0.00 - 1.00)</p>
            </div>

            {/* Availability Weight */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Availability Weight</label>
                <span className="text-sm font-mono bg-green-100 text-green-800 px-2 py-1 rounded">
                  {(tuning.w_avail || 0.80).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tuning.w_avail || 0.80}
                onChange={(e) => setTuning({ ...tuning, w_avail: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider availability-weight"
              />
              <p className="text-xs text-gray-500">Availability pressure impact (0.00 - 1.00)</p>
            </div>

            {/* Events Weight */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Events Weight</label>
                <span className="text-sm font-mono bg-purple-100 text-purple-800 px-2 py-1 rounded">
                  {(tuning.w_event || 0.3).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tuning.w_event || 0.3}
                onChange={(e) => setTuning({ ...tuning, w_event: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider events-weight"
              />
              <p className="text-xs text-gray-500">Events and holidays impact (0.00 - 1.00)</p>
            </div>
          </div>

          {/* Sensitivity Parameters */}
          <div className="space-y-6 border-t pt-6">
            <h3 className="text-lg font-medium text-gray-800">Sensitivity Controls</h3>
            
            {/* Alpha */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Demand Sensitivity (Alpha)</label>
                <span className="text-sm font-mono bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  {(tuning.alpha || 0.12).toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.001"
                value={tuning.alpha || 0.12}
                onChange={(e) => setTuning({ ...tuning, alpha: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider alpha-sensitivity"
              />
              <p className="text-xs text-gray-500">Exponential sensitivity factor (0.000 - 0.500)</p>
            </div>

            {/* Beta */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Competitor Sensitivity (Beta)</label>
                <span className="text-sm font-mono bg-red-100 text-red-800 px-2 py-1 rounded">
                  {(tuning.beta || 0.10).toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.3"
                step="0.001"
                value={tuning.beta || 0.10}
                onChange={(e) => setTuning({ ...tuning, beta: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider beta-sensitivity"
              />
              <p className="text-xs text-gray-500">Competitor price reaction strength (0.000 - 0.300)</p>
            </div>
          </div>

          {/* Bounds Parameters */}
          <div className="space-y-6 border-t pt-6">
            <h3 className="text-lg font-medium text-gray-800">Demand Factor Bounds</h3>
            
            {/* Min Factor */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Minimum Demand Factor</label>
                <span className="text-sm font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {(tuning.demand_min || 0.80).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={tuning.demand_min || 0.80}
                onChange={(e) => setTuning({ ...tuning, demand_min: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider demand-bounds"
              />
              <p className="text-xs text-gray-500">Price floor protection (0.50 - 1.00)</p>
            </div>

            {/* Max Factor */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">Maximum Demand Factor</label>
                <span className="text-sm font-mono bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                  {(tuning.demand_max || 1.40).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={tuning.demand_max || 1.40}
                onChange={(e) => setTuning({ ...tuning, demand_max: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider demand-bounds"
              />
              <p className="text-xs text-gray-500">Price ceiling protection (1.00 - 3.00)</p>
            </div>
          </div>

          <div className="border-t pt-6">
            <Button onClick={handleSaveTuning} disabled={saving} className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              {saving ? 'Saving Parameters...' : 'Save Tuning Parameters'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Formula Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Live Formula Preview
          </CardTitle>
          <p className="text-sm text-gray-600">
            Formula updates in real-time as you adjust the sliders above
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Raw Signal Formula */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Step 1: Raw Signal Score</h4>
              <div className="font-mono text-sm text-blue-700">
                raw = <span className="font-bold">{(tuning.w_pickup || 0.4).toFixed(2)}</span> × pickup_proxy + <span className="font-bold">{(tuning.w_avail || 0.80).toFixed(2)}</span> × (-availability_proxy) + <span className="font-bold">{(tuning.w_event || 0.3).toFixed(2)}</span> × (events_weight - 1)
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Combines booking pace, room availability pressure, and event impacts
              </p>
            </div>

            {/* Demand Auto Formula */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="text-sm font-semibold text-green-800 mb-2">Step 2: Auto Demand Calculation</h4>
              <div className="font-mono text-sm text-green-700">
                demand_auto = clamp(exp(<span className="font-bold">{(tuning.alpha || 0.12).toFixed(3)}</span> × raw), <span className="font-bold">{(tuning.demand_min || 0.80).toFixed(2)}</span>, <span className="font-bold">{(tuning.demand_max || 1.40).toFixed(2)}</span>)
              </div>
              <p className="text-xs text-green-600 mt-2">
                Exponential curve with {(tuning.demand_min || 0.80).toFixed(2)}x to {(tuning.demand_max || 1.40).toFixed(2)}x bounds
              </p>
            </div>

            {/* Final Demand Formula */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="text-sm font-semibold text-purple-800 mb-2">Step 3: Final Demand Factor</h4>
              <div className="font-mono text-sm text-purple-700">
                final_demand = demand_auto × comp_pressure(β=<span className="font-bold">{(tuning.beta || 0.10).toFixed(3)}</span>) × manual_multiplier
              </div>
              <p className="text-xs text-purple-600 mt-2">
                Combines auto calculation with competitor pricing and manual overrides
              </p>
            </div>

            {/* Example Calculation */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">📊 Example Scenario</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Pickup pace = 0.5, Availability = 0.2, Event weight = 1.15</div>
                <div className="font-mono">
                  raw = {(tuning.w_pickup || 0.4).toFixed(2)}×0.5 + {(tuning.w_avail || 0.80).toFixed(2)}×(-0.2) + {(tuning.w_event || 0.3).toFixed(2)}×0.15 = {((tuning.w_pickup || 0.4) * 0.5 + (tuning.w_avail || 0.80) * (-0.2) + (tuning.w_event || 0.3) * 0.15).toFixed(3)}
                </div>
                <div className="font-mono">
                  demand_auto = exp({(tuning.alpha || 0.12).toFixed(3)} × {((tuning.w_pickup || 0.4) * 0.5 + (tuning.w_avail || 0.80) * (-0.2) + (tuning.w_event || 0.3) * 0.15).toFixed(3)}) = {Math.min(Math.max(Math.exp((tuning.alpha || 0.12) * ((tuning.w_pickup || 0.4) * 0.5 + (tuning.w_avail || 0.80) * (-0.2) + (tuning.w_event || 0.3) * 0.15)), tuning.demand_min || 0.80), tuning.demand_max || 1.40).toFixed(3)}
                </div>
                <div>
                  <span className="text-sm font-semibold">
                    Final multiplier: ~{Math.min(Math.max(Math.exp((tuning.alpha || 0.12) * ((tuning.w_pickup || 0.4) * 0.5 + (tuning.w_avail || 0.80) * (-0.2) + (tuning.w_event || 0.3) * 0.15)), tuning.demand_min || 0.80), tuning.demand_max || 1.40).toFixed(2)}x
                  </span>
                  {Math.min(Math.max(Math.exp((tuning.alpha || 0.12) * ((tuning.w_pickup || 0.4) * 0.5 + (tuning.w_avail || 0.80) * (-0.2) + (tuning.w_event || 0.3) * 0.15)), tuning.demand_min || 0.80), tuning.demand_max || 1.40) > 1 ? 
                    " (price increase)" : " (price decrease)"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const getMonthName = (month) => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[month - 1] || month;
  };

  const renderSeasonality = () => (
    <div className="space-y-6">
      {/* Header Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Seasonal Pricing Multipliers
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure seasonal pricing multipliers with custom date ranges and adjustable factors
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={addSeason} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Season
            </Button>
            <Button onClick={handleResetSeasonality} variant="outline" disabled={saving}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Season Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Season Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {seasonality.map((season, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Season Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">Season Name</label>
                  <Input
                    value={season.season_name}
                    onChange={(e) => updateSeason(index, 'season_name', e.target.value)}
                    placeholder="e.g., Summer Peak"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date</label>
                  <Input
                    type="date"
                    value={season.start_date}
                    onChange={(e) => updateSeason(index, 'start_date', e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <Input
                    type="date"
                    value={season.end_date}
                    onChange={(e) => updateSeason(index, 'end_date', e.target.value)}
                  />
                </div>

                {/* Recurring Toggle */}
                <div>
                  <label className="block text-sm font-medium mb-2">Recurring</label>
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="checkbox"
                      checked={season.year_recurring}
                      onChange={(e) => updateSeason(index, 'year_recurring', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Annual</span>
                  </div>
                </div>

                {/* Multiplier */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Multiplier 
                    <span className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">
                      {season.multiplier.toFixed(3)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.001"
                    value={season.multiplier}
                    onChange={(e) => updateSeason(index, 'multiplier', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <p className="text-xs text-gray-500 mt-1">0.5x - 2.0x pricing factor</p>
                </div>
              </div>

              {/* Season Info and Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-4">
                  <Badge variant="outline">
                    {formatDateRange(season.start_date, season.end_date)}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {season.multiplier > 1 
                      ? `+${((season.multiplier - 1) * 100).toFixed(1)}% price increase`
                      : `${((1 - season.multiplier) * 100).toFixed(1)}% price decrease`
                    }
                  </span>
                  {season.year_recurring && (
                    <Badge variant="secondary" className="text-xs">Recurring</Badge>
                  )}
                </div>
                <Button 
                  onClick={() => removeSeason(index)}
                  variant="destructive" 
                  size="sm"
                  disabled={seasonality.length <= 1}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Visual Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Seasonal Timeline Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Date-based season list */}
            <div className="space-y-2">
              {seasonality.map((season, index) => {
                const currentSeason = seasonality.find(s => {
                  const today = new Date();
                  return isDateInSeason(today, s);
                });
                const isCurrentSeason = currentSeason?.season_name === season.season_name;

                return (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
                    isCurrentSeason ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className="font-medium">{season.season_name}</div>
                      <Badge variant="outline">
                        {formatDateRange(season.start_date, season.end_date)}
                      </Badge>
                      {season.year_recurring && (
                        <Badge variant="secondary" className="text-xs">Recurring</Badge>
                      )}
                      {isCurrentSeason && (
                        <Badge className="text-xs bg-blue-600">Active Now</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono px-2 py-1 rounded ${
                        season.multiplier > 1 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {season.multiplier.toFixed(3)}x
                      </span>
                      <span className="text-sm text-gray-600">
                        {season.multiplier > 1 
                          ? `+${((season.multiplier - 1) * 100).toFixed(1)}%`
                          : `${((1 - season.multiplier) * 100).toFixed(1)}%`
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 rounded"></div>
                <span>Price Increase (&gt;1.0x)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 rounded"></div>
                <span>Price Decrease (&lt;1.0x)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Currently Active</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 justify-end">
            <Button onClick={handleSaveSeasonality} disabled={saving} className="px-8">
              <TrendingUp className="w-4 h-4 mr-2" />
              {saving ? 'Saving Settings...' : 'Save Seasonality Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOverrides = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Override Calendar</CardTitle>
          <p className="text-sm text-gray-600">
            Set manual demand multipliers for specific dates. Available in pricing calendar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Manual overrides are managed directly in the Pricing Calendar.</p>
            <p className="text-sm mt-2">
              Click on any date in the pricing view to set custom multipliers and locks.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Market Settings</h1>
            <p className="text-gray-600">Configure smart market demand calculations</p>
          </div>
          <Button onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200'
              : message.type === 'info'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : message.type === 'info' ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'competitors' && renderCompetitors()}
              {activeTab === 'events' && renderEvents()}
              {activeTab === 'tuning' && renderTuning()}
              {activeTab === 'seasonality' && renderSeasonality()}
              {activeTab === 'overrides' && renderOverrides()}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MarketSettingsPage;
