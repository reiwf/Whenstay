const { supabaseAdmin } = require('../config/supabase');
const dayjs = require('dayjs');

class CompetitorService {

  /**
   * Get all competitor sets for a location
   */
  async getCompetitorSets(locationId = null) {
    try {
      let query = supabaseAdmin
        .from('comp_sets')
        .select(`
          *,
          comp_members(
            id,
            label,
            property_type,
            source,
            external_id,
            is_active,
            created_at
          )
        `)
        .eq('is_active', true);

      // Handle null location ID properly
      if (locationId === null) {
        // When locationId is null, return all competitor sets (don't filter by location_id)
        // This allows the system to find any existing competitor sets
      } else {
        // When locationId is specified, find sets for that location OR global sets (location_id is null)
        query = query.or(`location_id.is.null,location_id.eq.${locationId}`);
      }

      query = query.order('name');

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching competitor sets:', error);
      throw error;
    }
  }

  /**
   * Create a new competitor set
   */
  async createCompetitorSet(locationId, name, description = '') {
    try {
      const { data, error } = await supabaseAdmin
        .from('comp_sets')
        .insert([{
          location_id: locationId,
          name,
          description
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating competitor set:', error);
      throw error;
    }
  }

  /**
   * Add competitor to a set
   */
  async addCompetitor(compSetId, competitorData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('comp_members')
        .insert([{
          comp_set_id: compSetId,
          source: competitorData.source || 'manual',
          external_id: competitorData.external_id,
          label: competitorData.label,
          property_type: competitorData.property_type,
          notes: competitorData.notes
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding competitor:', error);
      throw error;
    }
  }

  /**
   * Update competitor information
   */
  async updateCompetitor(competitorId, updateData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('comp_members')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', competitorId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating competitor:', error);
      throw error;
    }
  }

  /**
   * Remove/deactivate competitor
   */
  async removeCompetitor(competitorId, permanent = false) {
    try {
      if (permanent) {
        const { error } = await supabaseAdmin
          .from('comp_members')
          .delete()
          .eq('id', competitorId);

        if (error) {
          throw error;
        }

        return { deleted: true };
      } else {
        const { data, error } = await supabaseAdmin
          .from('comp_members')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', competitorId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      }
    } catch (error) {
      console.error('Error removing competitor:', error);
      throw error;
    }
  }

  /**
   * Input competitor price data for a specific date
   */
  async inputCompetitorPrices(compSetId, date, priceInputs) {
    try {
      // priceInputs is an array of { competitor_id, price } or just price values
      
      // Calculate statistics from the price inputs
      const prices = Array.isArray(priceInputs) 
        ? priceInputs.map(p => typeof p === 'object' ? p.price : p).filter(p => p && p > 0)
        : [priceInputs].filter(p => p && p > 0);

      if (prices.length === 0) {
        throw new Error('No valid prices provided');
      }

      // Sort prices for percentile calculations
      const sortedPrices = [...prices].sort((a, b) => a - b);
      
      const priceMin = Math.min(...prices);
      const priceMax = Math.max(...prices);
      const priceMedian = this.calculateMedian(sortedPrices);
      const priceP25 = this.calculatePercentile(sortedPrices, 0.25);
      const priceP75 = this.calculatePercentile(sortedPrices, 0.75);

      // Calculate lead days from today to stay date
      const leadDays = dayjs(date).diff(dayjs().startOf('day'), 'day');

      // Upsert competitor daily data
      const { data, error } = await supabaseAdmin
        .from('comp_daily')
        .upsert([{
          comp_set_id: compSetId,
          dt: date,
          lead_days: leadDays >= 0 ? leadDays : 0,
          price_median: Number(priceMedian.toFixed(2)),
          price_p25: Number(priceP25.toFixed(2)),
          price_p75: Number(priceP75.toFixed(2)),
          price_min: Number(priceMin.toFixed(2)),
          price_max: Number(priceMax.toFixed(2)),
          sample_size: prices.length,
          input_method: 'manual',
          notes: `Manual input of ${prices.length} competitor prices`,
          created_at: new Date().toISOString()
        }], {
          onConflict: 'comp_set_id,dt',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`📊 Updated competitor data for ${date}: median=${priceMedian}, range=${priceMin}-${priceMax}, n=${prices.length}`);

      return {
        ...data,
        price_statistics: {
          median: priceMedian,
          p25: priceP25,
          p75: priceP75,
          min: priceMin,
          max: priceMax,
          count: prices.length
        }
      };

    } catch (error) {
      console.error('Error inputting competitor prices:', error);
      throw error;
    }
  }

  /**
   * Bulk input competitor price data for multiple dates
   */
  async bulkInputCompetitorPrices(compSetId, priceDataArray) {
    try {
      // priceDataArray: [{ date, prices: [...] }, ...]
      const results = [];
      
      for (const { date, prices } of priceDataArray) {
        try {
          const result = await this.inputCompetitorPrices(compSetId, date, prices);
          results.push({ date, success: true, data: result });
        } catch (error) {
          console.error(`Error processing date ${date}:`, error);
          results.push({ date, success: false, error: error.message });
        }
      }

      return {
        total: priceDataArray.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };

    } catch (error) {
      console.error('Error in bulk input:', error);
      throw error;
    }
  }

  /**
   * Get competitor price data for a date range
   */
  async getCompetitorPrices(compSetId, fromDate, toDate) {
    try {
      const { data, error } = await supabaseAdmin
        .from('comp_daily')
        .select('*')
        .eq('comp_set_id', compSetId)
        .gte('dt', fromDate)
        .lte('dt', toDate)
        .order('dt');

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching competitor prices:', error);
      throw error;
    }
  }

  /**
   * Get competitor price summary for a location
   */
  async getCompetitorSummary(locationId = null, days = 30) {
    try {
      // Get the competitor set for this location
      const sets = await this.getCompetitorSets(locationId);
      const compSet = sets[0]; // Use first/default set

      if (!compSet) {
        return {
          has_competitors: false,
          active_competitors: 0,
          recent_price_data: 0
        };
      }

      // Count recent price entries
      const recentDate = dayjs().subtract(days, 'days').format('YYYY-MM-DD');
      
      const { data: recentEntries, error } = await supabaseAdmin
        .from('comp_daily')
        .select('dt')
        .eq('comp_set_id', compSet.id)
        .gte('dt', recentDate);

      if (error) {
        console.error('Error fetching recent competitor data:', error);
      }

      return {
        has_competitors: true,
        competitor_set_id: compSet.id,
        competitor_set_name: compSet.name,
        active_competitors: compSet.comp_members?.filter(m => m.is_active).length || 0,
        total_competitors: compSet.comp_members?.length || 0,
        recent_price_data: recentEntries?.length || 0,
        last_update: compSet.updated_at
      };

    } catch (error) {
      console.error('Error fetching competitor summary:', error);
      throw error;
    }
  }

  /**
   * Get competitor positioning analysis vs your pricing
   */
  async getCompetitorPositioning(compSetId, roomTypeId, date) {
    try {
      // Get your room type's current suggested price for this date
      const { data: yourPrice, error: priceError } = await supabaseAdmin
        .from('listing_prices')
        .select('suggested_price, override_price')
        .eq('room_type_id', roomTypeId)
        .eq('dt', date)
        .single();

      if (priceError && priceError.code !== 'PGRST116') {
        throw priceError;
      }

      const myPrice = yourPrice?.override_price || yourPrice?.suggested_price;

      // Get competitor data for this date
      const compData = await this.getCompetitorPrices(compSetId, date, date);
      const todayData = compData[0];

      if (!todayData || !myPrice) {
        return {
          has_data: false,
          my_price: myPrice,
          comp_data: todayData
        };
      }

      // Calculate positioning metrics
      const positioning = {
        my_price: myPrice,
        comp_median: todayData.price_median,
        comp_p25: todayData.price_p25,
        comp_p75: todayData.price_p75,
        comp_min: todayData.price_min,
        comp_max: todayData.price_max,
        sample_size: todayData.sample_size
      };

      // Price gap analysis
      positioning.price_gap_pct = ((myPrice - todayData.price_median) / todayData.price_median * 100).toFixed(1);
      positioning.gap_vs_median = myPrice - todayData.price_median;

      // Positioning categories
      if (myPrice < todayData.price_p25) {
        positioning.position = 'below_market';
        positioning.position_text = 'Below Market (< 25th percentile)';
      } else if (myPrice <= todayData.price_median) {
        positioning.position = 'lower_mid';
        positioning.position_text = 'Lower Mid-Market';
      } else if (myPrice <= todayData.price_p75) {
        positioning.position = 'upper_mid';
        positioning.position_text = 'Upper Mid-Market';
      } else {
        positioning.position = 'above_market';
        positioning.position_text = 'Above Market (> 75th percentile)';
      }

      return {
        has_data: true,
        date,
        ...positioning
      };

    } catch (error) {
      console.error('Error analyzing competitor positioning:', error);
      throw error;
    }
  }

  /**
   * Delete old competitor data (cleanup)
   */
  async cleanupOldData(daysToKeep = 365) {
    try {
      const cutoffDate = dayjs().subtract(daysToKeep, 'days').format('YYYY-MM-DD');
      
      const { data, error } = await supabaseAdmin
        .from('comp_daily')
        .delete()
        .lt('dt', cutoffDate);

      if (error) {
        throw error;
      }

      return { deleted: data?.length || 0, cutoff_date: cutoffDate };

    } catch (error) {
      console.error('Error cleaning up old competitor data:', error);
      throw error;
    }
  }

  /**
   * Utility: Calculate median of sorted array
   */
  calculateMedian(sortedArray) {
    if (sortedArray.length === 0) return 0;
    
    const mid = Math.floor(sortedArray.length / 2);
    
    if (sortedArray.length % 2 === 0) {
      return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
    } else {
      return sortedArray[mid];
    }
  }

  /**
   * Utility: Calculate percentile of sorted array
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    if (percentile <= 0) return sortedArray[0];
    if (percentile >= 1) return sortedArray[sortedArray.length - 1];
    
    const index = percentile * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Import competitor data from CSV format
   * Expected format: date,competitor1_price,competitor2_price,etc
   */
  async importFromCSV(compSetId, csvData) {
    try {
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',');
      
      // First column should be date, rest are competitor prices
      const dateColumnIndex = 0;
      const priceColumns = headers.slice(1);
      
      const importResults = [];
      
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        const date = row[dateColumnIndex];
        const prices = row.slice(1)
          .map(p => parseFloat(p.trim()))
          .filter(p => !isNaN(p) && p > 0);
        
        if (prices.length > 0) {
          try {
            const result = await this.inputCompetitorPrices(compSetId, date, prices);
            importResults.push({ date, success: true, prices: prices.length });
          } catch (error) {
            importResults.push({ date, success: false, error: error.message });
          }
        }
      }

      return {
        total_rows: lines.length - 1,
        successful: importResults.filter(r => r.success).length,
        failed: importResults.filter(r => !r.success).length,
        results: importResults
      };

    } catch (error) {
      console.error('Error importing CSV data:', error);
      throw error;
    }
  }
}

module.exports = new CompetitorService();
