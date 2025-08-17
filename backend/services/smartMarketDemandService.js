const { supabaseAdmin } = require('../config/supabase');
const dayjs = require('dayjs');

class SmartMarketDemandService {

  /**
   * Get market tuning parameters for calculations
   */
  async getTuningParams(locationId = null) {
    try {
      // Handle string "null" conversion to actual null
      const actualLocationId = locationId === 'null' ? null : locationId;
      
      let query = supabaseAdmin
        .from('market_tuning')
        .select('*')
        .eq('is_active', true);

      // Use .is() for null values, .eq() for actual UUIDs
      if (actualLocationId === null) {
        query = query.is('location_id', null);
      } else {
        query = query.eq('location_id', actualLocationId);
      }

      const { data, error } = await query
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      // Return defaults if no specific tuning found
      return data || {
        w_pickup: 0.40,
        w_avail: 0.30,
        w_event: 0.30,
        alpha: 0.12,
        beta: 0.10,
        demand_min: 0.80,
        demand_max: 1.40,
        comp_pressure_min: 0.90,
        comp_pressure_max: 1.10,
        ema_alpha: 0.30
      };
    } catch (error) {
      console.error('Error fetching tuning params:', error);
      // Return defaults on error
      return {
        w_pickup: 0.40,
        w_avail: 0.30,
        w_event: 0.30,
        alpha: 0.12,
        beta: 0.10,
        demand_min: 0.80,
        demand_max: 1.40,
        comp_pressure_min: 0.90,
        comp_pressure_max: 1.10,
        ema_alpha: 0.30
      };
    }
  }

  /**
   * Calculate seasonality auto factor for a date
   * Start with existing seed curve, apply monthly EMA smoothing
   */
  calculateSeasonalityAuto(date, previousMonthAvg = null) {
    const month = dayjs(date).month() + 1; // 1-12
    
    // Existing seed curve (from your original migration)
    let baseSeasonal;
    if ([12, 1, 2].includes(month)) baseSeasonal = 0.92;      // Winter
    else if ([3, 4, 5].includes(month)) baseSeasonal = 0.97;  // Spring  
    else if ([6, 7, 8].includes(month)) baseSeasonal = 1.15;  // Summer
    else baseSeasonal = 1.05;                                 // Fall

    // Apply monthly EMA smoothing if we have previous data
    if (previousMonthAvg !== null && previousMonthAvg > 0) {
      const emaAlpha = 0.30; // 30% new, 70% old
      return emaAlpha * baseSeasonal + (1 - emaAlpha) * previousMonthAvg;
    }

    return baseSeasonal;
  }

  /**
   * Calculate pickup proxy score for a date
   * Last 7 days reservations count for that stay date, normalized by total units
   */
  async calculatePickupProxy(roomTypeId, stayDate) {
    try {
      // Get total units for this room type
      const { data: roomType, error: rtError } = await supabaseAdmin
        .from('room_types')
        .select(`
          *,
          room_units!inner(*)
        `)
        .eq('id', roomTypeId)
        .eq('room_units.is_active', true)
        .single();

      if (rtError) {
        console.error('Error fetching room type for pickup calc:', rtError);
        return 0;
      }

      const totalUnits = roomType.room_units?.length || 1;

      // Count reservations created in last 7 days for this stay date
      const sevenDaysAgo = dayjs().subtract(7, 'days').toISOString();
      
      const { data: recentBookings, error: bookingError } = await supabaseAdmin
        .from('reservations')
        .select('id')
        .eq('room_type_id', roomTypeId)
        .lte('check_in_date', stayDate)
        .gt('check_out_date', stayDate) // Stay date is within reservation period
        .gte('created_at', sevenDaysAgo)
        .in('status', ['confirmed', 'checked_in', 'completed', 'new']);

      if (bookingError) {
        console.error('Error fetching recent bookings:', bookingError);
        return 0;
      }

      const pickupCount = recentBookings?.length || 0;
      
      // Normalize by total units to get proxy score
      return pickupCount / totalUnits;

    } catch (error) {
      console.error('Error calculating pickup proxy:', error);
      return 0;
    }
  }

  /**
   * Calculate availability proxy for a date
   * 1 - (booked_units/total_units); lower availability = higher demand signal
   */
  async calculateAvailabilityProxy(roomTypeId, stayDate) {
    try {
      // Use the existing occupancy function 
      const { data: occupancyData, error } = await supabaseAdmin
        .rpc('occupancy_by_date', {
          _room_type_id: roomTypeId,
          _start: stayDate,
          _end: stayDate
        });

      if (error) {
        console.error('Error calculating occupancy for availability:', error);
        return 0;
      }

      const dayData = occupancyData?.[0];
      if (!dayData || dayData.total_units === 0) {
        return 0;
      }

      // availability_proxy = 1 - (booked/total)
      const occupancyRatio = dayData.occupied_units / dayData.total_units;
      return 1 - occupancyRatio;

    } catch (error) {
      console.error('Error calculating availability proxy:', error);
      return 0;
    }
  }

  /**
   * Calculate combined events weight for a date
   * Product of all active holiday/event weights affecting this date
   */
  async calculateEventsWeight(date, locationId = null) {
    try {
      let eventsWeight = 1.0;

      // Get holidays for this date
      const { data: holidays, error: holidayError } = await supabaseAdmin
        .from('holidays')
        .select('weight')
        .eq('dt', date)
        .eq('is_active', true)
        .or(`location_id.is.null,location_id.eq.${locationId}`);

      if (holidayError) {
        console.error('Error fetching holidays:', holidayError);
      } else {
        holidays?.forEach(holiday => {
          eventsWeight *= parseFloat(holiday.weight) || 1.0;
        });
      }

      // Get events overlapping this date
      const { data: events, error: eventError } = await supabaseAdmin
        .from('events')
        .select('weight')
        .lte('start_date', date)
        .gt('end_date', date) // end_date is exclusive
        .eq('is_active', true)
        .or(`location_id.is.null,location_id.eq.${locationId}`);

      if (eventError) {
        console.error('Error fetching events:', eventError);
      } else {
        events?.forEach(event => {
          eventsWeight *= parseFloat(event.weight) || 1.0;
        });
      }

      return eventsWeight;

    } catch (error) {
      console.error('Error calculating events weight:', error);
      return 1.0;
    }
  }

  /**
   * Calculate demand auto using your specified formula
   */
  async calculateDemandAuto(roomTypeId, stayDate, locationId = null) {
    try {
      const tuning = await this.getTuningParams(locationId);

      // Calculate component signals
      const pickupProxy = await this.calculatePickupProxy(roomTypeId, stayDate);
      const availabilityProxy = await this.calculateAvailabilityProxy(roomTypeId, stayDate);
      const eventsWeight = await this.calculateEventsWeight(stayDate, locationId);

      // Your formula:
      // raw = w_pickup * pickup_proxy + w_avail * (-availability_proxy) + w_event * (events_weight - 1)
      const raw = 
        tuning.w_pickup * pickupProxy +
        tuning.w_avail * (-availabilityProxy) + // Lower avail = positive push
        tuning.w_event * (eventsWeight - 1);

      // demand_auto = clamp(exp(alpha * raw), demand_min, demand_max)
      const demandAuto = this.clamp(
        Math.exp(tuning.alpha * raw),
        tuning.demand_min,
        tuning.demand_max
      );

      return {
        demand_auto: demandAuto,
        pickup_z: pickupProxy,
        availability_z: -availabilityProxy, // Store as negative for audit
        events_weight: eventsWeight,
        raw_score: raw
      };

    } catch (error) {
      console.error('Error calculating demand auto:', error);
      return {
        demand_auto: 1.0,
        pickup_z: 0,
        availability_z: 0,
        events_weight: 1.0,
        raw_score: 0
      };
    }
  }

  /**
   * Calculate competitor pressure auto factor
   */
  async calculateCompPressureAuto(roomTypeId, stayDate, basePrice, seasonalityEffective, locationId = null) {
    try {
      const tuning = await this.getTuningParams(locationId);

      // Get competitor set for this location
      const { data: compSet, error: setError } = await supabaseAdmin
        .from('comp_sets')
        .select('id')
        .eq('location_id', locationId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (setError || !compSet) {
        // No competitor data available
        return {
          comp_pressure_auto: 1.0,
          comp_price_z: 0
        };
      }

      // Get competitor data for this date
      const { data: compData, error: compError } = await supabaseAdmin
        .from('comp_daily')
        .select('price_median')
        .eq('comp_set_id', compSet.id)
        .eq('dt', stayDate)
        .single();

      if (compError || !compData?.price_median) {
        // No competitor price data for this date
        return {
          comp_pressure_auto: 1.0,
          comp_price_z: 0
        };
      }

      // my_ref_price = base_price * seasonality_effective (date-aware reference)
      const myRefPrice = basePrice * seasonalityEffective;

      // price_gap = (comp_median / my_ref_price) - 1
      const priceGap = (compData.price_median / myRefPrice) - 1;

      // comp_pressure_auto = clamp(exp(beta * price_gap), comp_pressure_min, comp_pressure_max)
      const compPressureAuto = this.clamp(
        Math.exp(tuning.beta * priceGap),
        tuning.comp_pressure_min,
        tuning.comp_pressure_max
      );

      return {
        comp_pressure_auto: compPressureAuto,
        comp_price_z: priceGap
      };

    } catch (error) {
      console.error('Error calculating competitor pressure:', error);
      return {
        comp_pressure_auto: 1.0,
        comp_price_z: 0
      };
    }
  }

  /**
   * Calculate all smart market factors for a single date
   */
  async calculateSmartMarketFactors(roomTypeId, stayDate, basePrice, locationId = null) {
    try {
      // Get current market factors to check for manual overrides
      const { data: currentFactors, error: factorsError } = await supabaseAdmin
        .from('market_factors')
        .select('*')
        .eq('dt', stayDate)
        .or(`location_id.is.null,location_id.eq.${locationId}`)
        .single();

      if (factorsError && factorsError.code !== 'PGRST116') {
        throw factorsError;
      }

      // If locked, don't recalculate auto values
      if (currentFactors?.lock_auto) {
        return {
          seasonality_auto: currentFactors.seasonality_auto,
          demand_auto: currentFactors.demand_auto,
          comp_pressure_auto: currentFactors.comp_pressure_auto,
          manual_multiplier: currentFactors.manual_multiplier || 1.0,
          pickup_z: currentFactors.pickup_z,
          availability_z: currentFactors.availability_z,
          events_weight: currentFactors.events_weight,
          comp_price_z: currentFactors.comp_price_z,
          locked: true
        };
      }

      // Calculate seasonality auto
      const prevMonthData = currentFactors?.seasonality_auto; // Could enhance to get actual previous month avg
      const seasonalityAuto = this.calculateSeasonalityAuto(stayDate, prevMonthData);

      // Calculate demand auto
      const demandResult = await this.calculateDemandAuto(roomTypeId, stayDate, locationId);

      // Calculate competitor pressure auto
      const compResult = await this.calculateCompPressureAuto(
        roomTypeId, 
        stayDate, 
        basePrice, 
        seasonalityAuto, 
        locationId
      );

      const manualMultiplier = currentFactors?.manual_multiplier || 1.0;

      return {
        seasonality_auto: seasonalityAuto,
        demand_auto: demandResult.demand_auto,
        comp_pressure_auto: compResult.comp_pressure_auto,
        manual_multiplier: manualMultiplier,
        pickup_z: demandResult.pickup_z,
        availability_z: demandResult.availability_z,
        events_weight: demandResult.events_weight,
        comp_price_z: compResult.comp_price_z,
        locked: false
      };

    } catch (error) {
      console.error('Error calculating smart market factors:', error);
      throw error;
    }
  }

  /**
   * Calculate final effective demand for pricing engine
   * demand_effective = clamp(demand_auto * comp_pressure_auto * manual_multiplier, demand_min, demand_max)
   */
  calculateEffectiveDemand(demandAuto, compPressureAuto, manualMultiplier, tuning) {
    return this.clamp(
      demandAuto * compPressureAuto * manualMultiplier,
      tuning.demand_min,
      tuning.demand_max
    );
  }

  /**
   * Update market factors for a date range with smart calculations - BATCHED VERSION
   * Optimized to eliminate N+1 queries and dramatically improve performance
   */
  async updateSmartMarketFactors(roomTypeId, fromDate, toDate, locationId = null) {
    try {
      console.log(`🧠 [BATCHED] Updating smart market factors for room type ${roomTypeId} from ${fromDate} to ${toDate}`);
      const startTime = Date.now();

      // Get tuning parameters once
      const tuning = await this.getTuningParams(locationId);

      // Get room type base price once
      const { data: roomType, error: rtError } = await supabaseAdmin
        .from('room_types')
        .select('base_price')
        .eq('id', roomTypeId)
        .single();

      if (rtError) {
        throw rtError;
      }

      const basePrice = roomType.base_price;
      if (!basePrice) {
        throw new Error('Room type must have base_price set');
      }

      // Single RPC call to get ALL signals for the entire date range
      const { data: signals, error: signalsError } = await supabaseAdmin.rpc('market_signals_by_date', {
        _room_type_id: roomTypeId,
        _location_id: locationId,
        _start: fromDate,
        _end: toDate
      });

      if (signalsError) {
        throw signalsError;
      }

      console.log(`📊 Retrieved signals for ${signals?.length || 0} dates in ${Date.now() - startTime}ms`);

      // Get existing locked dates to skip them
      const { data: lockedFactors, error: lockedError } = await supabaseAdmin
        .from('market_factors')
        .select('dt')
        .eq('lock_auto', true)
        .gte('dt', fromDate)
        .lte('dt', toDate)
        .or(`location_id.is.null,location_id.eq.${locationId}`);

      if (lockedError) {
        console.error('Error fetching locked dates:', lockedError);
      }

      const lockedDates = new Set((lockedFactors || []).map(f => f.dt));

      // Compute factors in-memory (fast)
      const rows = [];
      for (const s of signals || []) {
        // Skip locked dates
        if (lockedDates.has(s.dt)) {
          console.log(`🔒 Skipping locked date: ${s.dt}`);
          continue;
        }

        // Calculate seasonality auto (could be enhanced with monthly EMA later)
        const seasonality_auto = this.calculateSeasonalityAuto(s.dt, null);
        const myRef = basePrice * seasonality_auto;

        // Calculate proxies from the batch data
        const pickup_proxy = s.total_units ? (s.pickup_7d / s.total_units) : 0;
        const availability_proxy = s.total_units ? (1 - (s.occupied_units / s.total_units)) : 1;

        // Apply the demand formula
        const raw = tuning.w_pickup * pickup_proxy
                  + tuning.w_avail * (-availability_proxy)
                  + tuning.w_event * ((s.events_weight ?? 1) - 1);

        const demand_auto = this.clamp(
          Math.exp(tuning.alpha * raw), 
          tuning.demand_min, 
          tuning.demand_max
        );

        // Calculate competitor pressure (if price data available)
        let comp_price_z = 0;
        let comp_pressure_auto = 1.0;
        if (s.comp_price_median && myRef > 0) {
          const gap = (s.comp_price_median / myRef) - 1;
          comp_price_z = gap;
          comp_pressure_auto = this.clamp(
            Math.exp(tuning.beta * gap), 
            tuning.comp_pressure_min, 
            tuning.comp_pressure_max
          );
        }

        // Calculate effective demand for pricing engine
        const manual_multiplier = 1.0; // Default, will be overridden by existing manual values
        const demand_effective = this.clamp(
          demand_auto * comp_pressure_auto * manual_multiplier, 
          tuning.demand_min, 
          tuning.demand_max
        );

        rows.push({
          location_id: locationId,
          dt: s.dt,
          seasonality_auto: +seasonality_auto.toFixed(3),
          seasonality: +seasonality_auto.toFixed(3),
          demand_auto: +demand_auto.toFixed(3),
          demand: +demand_effective.toFixed(3),
          comp_pressure_auto: +comp_pressure_auto.toFixed(3),
          manual_multiplier: 1.00,
          pickup_z: +pickup_proxy.toFixed(3),
          availability_z: +(-availability_proxy).toFixed(3),
          events_weight: +(s.events_weight ?? 1).toFixed(3),
          comp_price_z: +comp_price_z.toFixed(3),
          updated_at: new Date().toISOString()
        });
      }

      // Upsert in chunks to avoid payload timeouts
      const chunkSize = 200;
      let totalUpdated = 0;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: upsertError } = await supabaseAdmin
          .from('market_factors')
          .upsert(chunk, { 
            onConflict: 'location_id,dt',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          throw upsertError;
        }

        totalUpdated += chunk.length;
        console.log(`📦 Upserted chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(rows.length/chunkSize)} (${chunk.length} records)`);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [BATCHED] Updated ${totalUpdated} market factor records in ${duration}ms (${(duration/1000).toFixed(1)}s)`);
      console.log(`⚡ Performance: ${(totalUpdated/(duration/1000)).toFixed(0)} records/second`);

      return { success: true, updated: totalUpdated };

    } catch (error) {
      console.error('Error in batched smart market factors update:', error);
      throw error;
    }
  }

  /**
   * Legacy method - kept for backward compatibility but now uses batched approach
   */
  async updateSmartMarketFactorsLegacy(roomTypeId, fromDate, toDate, locationId = null) {
    console.log(`⚠️ Using legacy method - consider migrating to batched approach`);
    return this.updateSmartMarketFactors(roomTypeId, fromDate, toDate, locationId);
  }

  /**
   * Get market factor breakdown for "why this price" display
   */
  async getMarketFactorBreakdown(locationId, date) {
    try {
      const { data, error } = await supabaseAdmin
        .from('market_factors')
        .select('*')
        .eq('dt', date)
        .or(`location_id.is.null,location_id.eq.${locationId}`)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return { error: 'No market factor data found for this date' };
      }

      return {
        date,
        effective_seasonality: data.seasonality,
        effective_demand: data.demand,
        breakdown: {
          seasonality_auto: data.seasonality_auto,
          demand_auto: data.demand_auto,
          comp_pressure_auto: data.comp_pressure_auto,
          manual_multiplier: data.manual_multiplier,
          pickup_signal: data.pickup_z,
          availability_signal: data.availability_z,
          events_weight: data.events_weight,
          competitor_gap: data.comp_price_z,
          is_locked: data.lock_auto
        },
        manual_notes: data.manual_notes
      };

    } catch (error) {
      console.error('Error fetching market factor breakdown:', error);
      throw error;
    }
  }

  /**
   * Set manual override for a specific date
   */
  async setManualOverride(locationId, date, manualMultiplier, lockAuto = false, notes = '') {
    try {
      const tuning = await this.getTuningParams(locationId);
      
      // Get existing data
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('market_factors')
        .select('*')
        .eq('dt', date)
        .or(`location_id.is.null,location_id.eq.${locationId}`)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Calculate new effective demand
      const demandAuto = existing?.demand_auto || 1.0;
      const compPressureAuto = existing?.comp_pressure_auto || 1.0;
      
      const effectiveDemand = this.calculateEffectiveDemand(
        demandAuto,
        compPressureAuto,
        manualMultiplier,
        tuning
      );

      // Update/insert with manual override
      const { data, error } = await supabaseAdmin
        .from('market_factors')
        .upsert([{
          location_id: locationId,
          dt: date,
          seasonality_auto: existing?.seasonality_auto,
          seasonality: existing?.seasonality_auto || existing?.seasonality,
          demand_auto: demandAuto,
          demand: effectiveDemand,
          comp_pressure_auto: compPressureAuto,
          manual_multiplier: manualMultiplier,
          lock_auto: lockAuto,
          manual_notes: notes,
          pickup_z: existing?.pickup_z,
          availability_z: existing?.availability_z,
          events_weight: existing?.events_weight,
          comp_price_z: existing?.comp_price_z,
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'location_id,dt',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Error setting manual override:', error);
      throw error;
    }
  }

  /**
   * Utility function to clamp values within range
   */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Get tuning parameters for admin UI
   */
  async getTuningForLocation(locationId) {
    return this.getTuningParams(locationId);
  }

  /**
   * Update tuning parameters
   */
  async updateTuning(locationId, tuningParams) {
    try {
      // Remove id and other system fields to avoid conflicts
      const { id, created_at, updated_at, is_active, ...cleanParams } = tuningParams;
      
      const { data, error } = await supabaseAdmin
        .from('market_tuning')
        .upsert([{
          location_id: locationId,
          ...cleanParams,
          is_active: true, // Ensure it stays active
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'location_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Error updating tuning parameters:', error);
      throw error;
    }
  }
}

module.exports = new SmartMarketDemandService();
