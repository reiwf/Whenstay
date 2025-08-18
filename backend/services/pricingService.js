const { supabaseAdmin } = require('../config/supabase');
const dayjs = require('dayjs');

class PricingService {
  
  /**
   * Get pricing rules for a room type
   */
  async getRules(roomTypeId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pricing_rules')
        .select('*')
        .eq('room_type_id', roomTypeId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || {};
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      throw new Error('Failed to fetch pricing rules');
    }
  }

  /**
   * Update/upsert pricing rules for a room type
   */
  async updateRules(roomTypeId, rulesData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pricing_rules')
        .upsert([{ 
          room_type_id: roomTypeId, 
          ...rulesData,
          updated_at: new Date().toISOString() 
        }], { 
          onConflict: 'room_type_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating pricing rules:', error);
      throw new Error('Failed to update pricing rules');
    }
  }

  /**
   * Get calendar prices for a room type within date range
   */
  async getCalendar(roomTypeId, from, to) {
    try {
      const { data, error } = await supabaseAdmin
        .from('listing_prices')
        .select('dt, suggested_price, override_price, locked')
        .eq('room_type_id', roomTypeId)
        .gte('dt', from)
        .lte('dt', to)
        .order('dt');

      if (error) {
        throw error;
      }

      // Transform to match API contract
      const days = (data || []).map(row => ({
        date: row.dt,
        price: row.override_price ?? row.suggested_price,
        hasOverride: row.override_price !== null,
        locked: row.locked
      }));

      return { roomTypeId, days };
    } catch (error) {
      console.error('Error fetching calendar:', error);
      throw new Error('Failed to fetch calendar');
    }
  }

  /**
   * Set price override for a specific date
   */
  async setOverride(roomTypeId, date, price, locked = false) {
    try {
      const { data, error } = await supabaseAdmin
        .from('listing_prices')
        .upsert([{
          room_type_id: roomTypeId,
          dt: date,
          override_price: price,
          locked: locked,
          updated_at: new Date().toISOString()
        }], { 
          onConflict: 'room_type_id,dt',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error setting price override:', error);
      throw new Error('Failed to set price override');
    }
  }

  /**
   * Get price breakdown for a specific date
   */
  async getBreakdown(roomTypeId, date) {
    try {
      const { data, error } = await supabaseAdmin
        .from('pricing_audit')
        .select('*')
        .eq('room_type_id', roomTypeId)
        .eq('dt', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        return { error: 'No pricing data found for this date' };
      }

      return {
        roomTypeId,
        date,
        price: data.final_price,
        breakdown: {
          basePrice: data.base_price,
          seasonality: data.seasonality,
          dow: data.dow,
          leadTime: data.lead_time,
          los: data.los,
          demand: data.demand,
          occupancy: data.occupancy,
          occupancyPct: data.occupancy_pct,
          orphan: data.orphan,
          unclamped: data.unclamped,
          minPrice: data.min_price,
          maxPrice: data.max_price,
          daysOut: data.days_out
        }
      };
    } catch (error) {
      console.error('Error fetching breakdown:', error);
      throw new Error('Failed to fetch breakdown');
    }
  }

  /**
   * Get seasonality factor for a specific date and location
   * Falls back to 1.0 if no seasonality configured
   */
  async getSeasonalityFactor(date, locationId = null) {
    try {
      const actualLocationId = locationId === 'null' ? null : locationId;
      
      let query = supabaseAdmin
        .from('seasonality_settings')
        .select('*')
        .eq('is_active', true);

      // Location-specific first, then global fallback
      if (actualLocationId === null) {
        query = query.is('location_id', null);
      } else {
        query = query.or(`location_id.eq.${actualLocationId},location_id.is.null`);
      }

      const { data: seasons, error } = await query.order('display_order');

      if (error) {
        console.error('Error fetching seasonality settings:', error);
        return 1.0; // Fallback
      }

      // Find matching season for this date
      for (const season of seasons || []) {
        if (this.isDateInSeason(date, season)) {
          return parseFloat(season.multiplier) || 1.0;
        }
      }

      return 1.0; // Default if no season matches
    } catch (error) {
      console.error('Error calculating seasonality factor:', error);
      return 1.0; // Safe fallback
    }
  }

  /**
   * Check if a date falls within a seasonal range
   * Handles year wrap-around and recurring seasons
   */
  isDateInSeason(checkDate, season) {
    const checkMoment = dayjs(checkDate);
    const startMoment = dayjs(season.start_date);
    const endMoment = dayjs(season.end_date);

    if (!season.year_recurring) {
      // Non-recurring: exact date range match
      return checkMoment.isSameOrAfter(startMoment, 'day') && checkMoment.isSameOrBefore(endMoment, 'day');
    }

    // Recurring: check if the date falls within the annual pattern
    const checkMonth = checkMoment.month() + 1;
    const checkDay = checkMoment.date();
    const startMonth = startMoment.month() + 1;
    const startDay = startMoment.date();
    const endMonth = endMoment.month() + 1;
    const endDay = endMoment.date();

    const checkValue = checkMonth * 100 + checkDay;
    const startValue = startMonth * 100 + startDay;
    const endValue = endMonth * 100 + endDay;

    if (startValue <= endValue) {
      return checkValue >= startValue && checkValue <= endValue;
    } else {
      // Wrap-around range (e.g., Winter: Dec 1 - Feb 28)
      return checkValue >= startValue || checkValue <= endValue;
    }
  }

  /**
   * Helper function to pick value from bucket based on range
   */
  pickBucketValue(value, spec = {}) {
    for (const key of Object.keys(spec)) {
      if (key.endsWith('+')) {
        const lo = parseFloat(key);
        if (value >= lo) return spec[key];
      } else {
        const [lo, hi] = key.split('-').map(Number);
        if (value >= lo && value <= hi) return spec[key];
      }
    }
    return 1; // Default fallback
  }

  /**
   * Get lead time bucket spec from occupancy grid
   */
  pickLeadSpec(daysOut, grid) {
    if (!grid || !grid.leadBuckets) return {};
    
    const leadBuckets = grid.leadBuckets;
    for (const key of Object.keys(leadBuckets)) {
      if (key.endsWith('+')) {
        const lo = parseInt(key);
        if (daysOut >= lo) return leadBuckets[key];
      } else {
        const [lo, hi] = key.split('-').map(Number);
        if (daysOut >= lo && daysOut <= hi) return leadBuckets[key];
      }
    }
    return leadBuckets['61+'] || {};
  }

  /**
   * Calculate occupancy adjustment factor from grid
   */
  calculateOccupancyAdjustment(daysOut, occPct, grid) {
    const leadSpec = this.pickLeadSpec(daysOut, grid);
    const percent = this.pickBucketValue(occPct, leadSpec);
    const factor = 1 + (percent / 100); // Convert percent to factor
    return { factor, percent };
  }

  /**
   * Core pricing calculation for a single date with enhanced smart market factors
   */
  calculatePrice(params) {
    const { 
      basePrice, minPrice, maxPrice, date, los = 1, daysOut, 
      factors, rules, occPct = 0 
    } = params;

    // Get day of week
    const dowStr = dayjs(date).format('ddd'); // Mon, Tue, etc.
    
    // Extract basic factors
    const seasonality = factors.seasonality[date] || 1;
    const dowFactor = (rules.dow_adjustments || {})[dowStr] || 1;
    
    // Enhanced smart market demand factors
    const demandFactor = factors.demand[date] || 1; // This now includes the full smart demand calculation
    const compPressureFactor = factors.compPressure[date] || 1;
    const manualMultiplier = factors.manualMultiplier[date] || 1;
    const eventsWeight = factors.eventsWeight[date] || 1;
    
    // Traditional pricing factors
    const leadTimeFactor = this.pickBucketValue(daysOut, rules.lead_time_curve || {});
    const losFactor = this.pickBucketValue(los, rules.los_discounts || {});
    
    // Occupancy factor from grid
    const occAdj = this.calculateOccupancyAdjustment(
      daysOut, 
      occPct, 
      rules.occupancy_grid || { mode: "percent", leadBuckets: { "0-100": { "0-100": 0 } } }
    );
    
    // Orphan gap factor (default to 1 for now)
    const orphanFactor = 1;
    
    // Calculate unclamped price with enhanced smart market factors
    // Note: demandFactor already includes pickup, availability, and events signals
    // compPressureFactor adds competitor positioning adjustments
    // manualMultiplier allows for manual overrides
    const unclamped = basePrice * seasonality * dowFactor * leadTimeFactor * 
                      losFactor * demandFactor * compPressureFactor * 
                      manualMultiplier * occAdj.factor * orphanFactor;
    
    // Clamp to min/max
    const final = Math.min(Math.max(unclamped, minPrice), maxPrice);
    
    return {
      final,
      breakdown: {
        basePrice,
        seasonality,
        dow: dowFactor,
        leadTime: leadTimeFactor,
        los: losFactor,
        demand: demandFactor,
        compPressure: compPressureFactor,
        manualMultiplier,
        eventsWeight, // For audit/transparency
        occupancy: occAdj.factor,
        occupancyPct: parseFloat(occPct.toFixed(2)),
        occupancyPercent: occAdj.percent,
        orphan: orphanFactor,
        unclamped,
        minPrice,
        maxPrice,
        daysOut,
        // Enhanced breakdown for audit
        pickupSignal: factors.pickupSignal[date] || 0,
        availabilitySignal: factors.availabilitySignal[date] || 0,
        compPriceSignal: factors.compPriceSignal[date] || 0
      }
    };
  }

  /**
   * Run pricing calculation for a room type and date range
   */
  async runPricing(roomTypeId, from, to, locationId = null) {
    try {
      // Start timing
      const startTime = new Date();
      
      // Create pricing run record
      const { data: pricingRun, error: runError } = await supabaseAdmin
        .from('pricing_runs')
        .insert([{
          room_type_id: roomTypeId,
          date_range_start: from,
          date_range_end: to,
          started_at: startTime.toISOString()
        }])
        .select()
        .single();

      if (runError) {
        throw runError;
      }

      // Get room type details
      const { data: roomType, error: rtError } = await supabaseAdmin
        .from('room_types')
        .select('*')
        .eq('id', roomTypeId)
        .single();

      if (rtError) {
        throw rtError;
      }

      // Validate required pricing data
      if (!roomType.base_price || roomType.base_price <= 0) {
        throw new Error(`Room type "${roomType.name}" must have a valid base price set before pricing can be calculated`);
      }

      if (!roomType.min_price || roomType.min_price <= 0) {
        throw new Error(`Room type "${roomType.name}" must have a valid minimum price set`);
      }

      if (!roomType.max_price || roomType.max_price <= 0) {
        throw new Error(`Room type "${roomType.name}" must have a valid maximum price set`);
      }

      // Get pricing rules
      const rules = await this.getRules(roomTypeId);

      // Get market factors for date range with proper location handling (excluding seasonality - now handled directly)
      let marketFactorsQuery = supabaseAdmin
        .from('market_factors')
        .select(`
          dt, 
          demand, 
          comp_pressure_auto,
          manual_multiplier,
          events_weight,
          pickup_z,
          availability_z,
          comp_price_z
        `)
        .gte('dt', from)
        .lte('dt', to)
        .limit(4000);

      // Handle location filtering with proper null checks (like in smartMarketDemandService)
      if (locationId === null || locationId === 'null') {
        marketFactorsQuery = marketFactorsQuery.is('location_id', null);
      } else {
        marketFactorsQuery = marketFactorsQuery.or(`location_id.is.null,location_id.eq.${locationId}`);
      }

      const { data: marketFactors, error: mfError } = await marketFactorsQuery;

      if (mfError) {
        throw mfError;
      }

      // Get occupancy data using RPC
      const { data: occupancyRows, error: occError } = await supabaseAdmin
        .rpc('occupancy_by_date', {
          _room_type_id: roomTypeId,
          _start: from,
          _end: to
        });

      if (occError) {
        throw occError;
      }

      // Get seasonality factors directly from seasonality_settings for each date
      const seasonalityFactors = {};
      for (const occRow of occupancyRows || []) {
        const date = occRow.dt;
        seasonalityFactors[date] = await this.getSeasonalityFactor(date, locationId);
      }

      // Convert market factors to lookup objects with enhanced data (excluding seasonality)
      const factors = {
        seasonality: seasonalityFactors, // Now using direct seasonality_settings lookup
        demand: Object.fromEntries((marketFactors || []).map(x => [x.dt, Number(x.demand) || 1])),
        compPressure: Object.fromEntries((marketFactors || []).map(x => [x.dt, Number(x.comp_pressure_auto) || 1])),
        manualMultiplier: Object.fromEntries((marketFactors || []).map(x => [x.dt, Number(x.manual_multiplier) || 1])),
        eventsWeight: Object.fromEntries((marketFactors || []).map(x => [x.dt, Number(x.events_weight) || 1])),
        pickupSignal: Object.fromEntries((marketFactors || []).map(x => [x.dt, Number(x.pickup_z) || 0])),
        availabilitySignal: Object.fromEntries((marketFactors || []).map(x => [x.dt, Number(x.availability_z) || 0])),
        compPriceSignal: Object.fromEntries((marketFactors || []).map(x => [x.dt, Number(x.comp_price_z) || 0]))
      };

      // Prepare bulk inserts
      const toInsertPrices = [];
      const toInsertAudit = [];

      // Calculate prices for each date
      for (const occRow of occupancyRows || []) {
        const date = occRow.dt;
        const daysOut = Math.max(dayjs(date).diff(dayjs().startOf('day'), 'day'), 0);
        const occPct = Number(occRow.occupancy_pct) || 0;

        const { final, breakdown } = this.calculatePrice({
          basePrice: roomType.base_price,
          minPrice: roomType.min_price,
          maxPrice: roomType.max_price,
          date,
          los: 1, // Default to 1 night
          daysOut,
          factors,
          rules,
          occPct
        });

        toInsertPrices.push({
          room_type_id: roomTypeId,
          dt: date,
          suggested_price: Math.round(final),
          source_run_id: pricingRun.id
        });

        toInsertAudit.push({
          room_type_id: roomTypeId,
          dt: date,
          base_price: breakdown.basePrice,
          seasonality: breakdown.seasonality,
          dow: breakdown.dow,
          lead_time: breakdown.leadTime,
          los: breakdown.los,
          demand: breakdown.demand,
          comp_pressure: breakdown.compPressure,
          manual_multiplier: breakdown.manualMultiplier,
          events_weight: breakdown.eventsWeight,
          occupancy: breakdown.occupancy,
          occupancy_pct: breakdown.occupancyPct,
          orphan: breakdown.orphan,
          unclamped: breakdown.unclamped,
          min_price: breakdown.minPrice,
          max_price: breakdown.maxPrice,
          final_price: Math.round(final),
          days_out: breakdown.daysOut,
          pickup_signal: breakdown.pickupSignal,
          availability_signal: breakdown.availabilitySignal,
          comp_price_signal: breakdown.compPriceSignal,
          run_id: pricingRun.id
        });
      }

      // Bulk upsert prices (respect locks and overrides)
      if (toInsertPrices.length > 0) {
        const { error: priceError } = await supabaseAdmin
          .from('listing_prices')
          .upsert(toInsertPrices, { 
            onConflict: 'room_type_id,dt',
            ignoreDuplicates: false 
          });

        if (priceError) {
          throw priceError;
        }
      }

      // Bulk insert audit records
      if (toInsertAudit.length > 0) {
        const { error: auditError } = await supabaseAdmin
          .from('pricing_audit')
          .insert(toInsertAudit);

        if (auditError) {
          throw auditError;
        }
      }

      // Update pricing run as finished
      const finishTime = new Date();
      await supabaseAdmin
        .from('pricing_runs')
        .update({ 
          finished_at: finishTime.toISOString(),
          notes: `Processed ${toInsertPrices.length} dates in ${finishTime - startTime}ms`
        })
        .eq('id', pricingRun.id);

      return { ok: true, priced: toInsertPrices.length };

    } catch (error) {
      console.error('Error running pricing:', error);
      throw new Error('Failed to run pricing calculation');
    }
  }
}

module.exports = new PricingService();
