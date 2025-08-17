-- Dynamic Pricing System Migration
-- This migration adds all tables, indexes, and functions needed for the pricing feature

-- 1. Extend room_types table with pricing fields
ALTER TABLE room_types 
ADD COLUMN IF NOT EXISTS min_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS max_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'JPY';

-- 2. pricing_rules table - Store pricing rules per room type
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  dow_adjustments JSONB DEFAULT '{"Mon": 0.95, "Tue": 0.95, "Wed": 0.98, "Thu": 1.0, "Fri": 1.1, "Sat": 1.2, "Sun": 1.0}',
  lead_time_curve JSONB DEFAULT '{"0-3": 0.9, "4-7": 0.95, "8-14": 1.0, "15-30": 1.05, "31-60": 1.08, "61+": 1.1}',
  los_discounts JSONB DEFAULT '{"1": 1.05, "2-3": 1.0, "4-6": 0.98, "7-27": 0.95, "28+": 0.9}',
  orphan_gaps JSONB DEFAULT '{"1": 0.9, "2": 0.85, "3-4": 0.8}',
  occupancy_grid JSONB DEFAULT '{
    "mode": "percent",
    "leadBuckets": {
      "0-15":  { "0-10": -15, "11-20": -15, "21-30": -10, "31-40": -5, "41-50": -5, "51-60": 0,  "61-100": 0 },
      "16-30": { "0-10": -10, "11-20": -10, "21-30": -5,  "31-40": -5, "41-50": 0,  "51-60": 0,  "61-100": 0 },
      "31-60": { "0-10": -5,  "11-20": -5,  "21-30": -5,  "31-40": 0,  "41-50": 0,  "51-60": 0,  "61-100": 0 },
      "61+":   { "0-100": 0 }
    }
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_type_id)
);

-- 3. market_factors table - Store seasonality and demand factors
CREATE TABLE IF NOT EXISTS market_factors (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  location_id UUID, -- Could reference properties.id or be separate
  dt DATE NOT NULL,
  seasonality DECIMAL(4,3) DEFAULT 1.0, -- 0.92, 1.15, etc.
  demand DECIMAL(4,3) DEFAULT 1.0,      -- 1.08 for weekends, events, etc.
  event_score DECIMAL(4,2) DEFAULT 0,
  holiday BOOLEAN DEFAULT FALSE,
  search_interest_index DECIMAL(4,2) DEFAULT 0,
  comp_availability_pct DECIMAL(5,2) DEFAULT 0,
  comp_median_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, dt)
);

-- 4. listing_prices table - Daily computed prices + overrides
CREATE TABLE IF NOT EXISTS listing_prices (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  dt DATE NOT NULL,
  suggested_price DECIMAL(10,2) NOT NULL,
  override_price DECIMAL(10,2), -- User manual override
  locked BOOLEAN DEFAULT FALSE,  -- Prevent auto-recalculation
  source_run_id UUID,           -- Track which pricing run generated this
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_type_id, dt)
);

-- 5. pricing_audit table - Complete breakdown for transparency
CREATE TABLE IF NOT EXISTS pricing_audit (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  dt DATE NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  seasonality DECIMAL(4,3) NOT NULL,
  dow DECIMAL(4,3) NOT NULL,
  lead_time DECIMAL(4,3) NOT NULL,
  los DECIMAL(4,3) NOT NULL,
  demand DECIMAL(4,3) NOT NULL,
  occupancy DECIMAL(4,3) NOT NULL,
  occupancy_pct DECIMAL(5,2) NOT NULL, -- Raw occupancy percentage for UI
  orphan DECIMAL(4,3) DEFAULT 1.0,
  unclamped DECIMAL(10,2) NOT NULL,    -- Before min/max clamp
  min_price DECIMAL(10,2) NOT NULL,
  max_price DECIMAL(10,2) NOT NULL,
  final_price DECIMAL(10,2) NOT NULL,
  days_out INTEGER,                    -- Lead time in days for UI
  run_id UUID,                        -- Link to pricing run
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. pricing_runs table - Track pricing computation runs
CREATE TABLE IF NOT EXISTS pricing_runs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  algorithm_version VARCHAR(50) DEFAULT 'v1.0',
  notes TEXT,
  room_type_id UUID REFERENCES room_types(id),
  date_range_start DATE,
  date_range_end DATE
);

-- Performance indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_pricing_rules_room_type_id ON pricing_rules(room_type_id);
CREATE INDEX IF NOT EXISTS idx_market_factors_location_date ON market_factors(location_id, dt);
CREATE INDEX IF NOT EXISTS idx_market_factors_date ON market_factors(dt);
CREATE INDEX IF NOT EXISTS idx_listing_prices_room_type_date ON listing_prices(room_type_id, dt);
CREATE INDEX IF NOT EXISTS idx_listing_prices_date_range ON listing_prices(dt);
CREATE INDEX IF NOT EXISTS idx_pricing_audit_room_type_date ON pricing_audit(room_type_id, dt);
CREATE INDEX IF NOT EXISTS idx_pricing_audit_latest ON pricing_audit(room_type_id, dt, created_at DESC);

-- Critical indexes for occupancy calculation performance
CREATE INDEX IF NOT EXISTS idx_reservations_occupancy_calc ON reservations(room_type_id, check_in_date, check_out_date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_room_unit_occupancy ON reservations(room_unit_id, check_in_date, check_out_date, status);
CREATE INDEX IF NOT EXISTS idx_room_units_room_type_active ON room_units(room_type_id, is_active);

-- Triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_pricing_rules_updated_at ON pricing_rules;
CREATE TRIGGER update_pricing_rules_updated_at 
  BEFORE UPDATE ON pricing_rules 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listing_prices_updated_at ON listing_prices;
CREATE TRIGGER update_listing_prices_updated_at 
  BEFORE UPDATE ON listing_prices 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RPC Function for occupancy calculation
CREATE OR REPLACE FUNCTION occupancy_by_date(
  _room_type_id UUID,
  _start DATE,
  _end DATE
) RETURNS TABLE (
  dt DATE,
  total_units INTEGER,
  occupied_units INTEGER,
  occupancy_pct DECIMAL(5,2)
) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(_start, _end, '1 day'::interval)::date as dt
  ),
  room_type_info AS (
    SELECT COUNT(*) as total_units
    FROM room_units ru
    JOIN room_types rt ON ru.room_type_id = rt.id
    WHERE rt.id = _room_type_id AND ru.is_active = true
  ),
  daily_occupancy AS (
    SELECT 
      ds.dt,
      COALESCE(COUNT(r.id), 0) as occupied_units
    FROM date_series ds
    LEFT JOIN reservations r ON (
      r.room_type_id = _room_type_id 
      AND r.check_in_date <= ds.dt 
      AND r.check_out_date > ds.dt
      AND r.status IN ('confirmed', 'checked_in', 'completed')
    )
    GROUP BY ds.dt
  )
  SELECT 
    occ.dt,
    rti.total_units::INTEGER,
    occ.occupied_units::INTEGER,
    CASE 
      WHEN rti.total_units > 0 THEN 
        ROUND((occ.occupied_units::DECIMAL / rti.total_units) * 100, 2) 
      ELSE 0 
    END as occupancy_pct
  FROM daily_occupancy occ
  CROSS JOIN room_type_info rti
  ORDER BY occ.dt;
END;
$$;

-- Initialize default pricing rules for existing room types
INSERT INTO pricing_rules (room_type_id)
SELECT id FROM room_types 
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_rules WHERE pricing_rules.room_type_id = room_types.id
);

-- Set default min/max prices for existing room types (if not already set)
UPDATE room_types 
SET 
  min_price = CASE WHEN min_price IS NULL THEN COALESCE(base_price * 0.7, 5000) ELSE min_price END,
  max_price = CASE WHEN max_price IS NULL THEN COALESCE(base_price * 1.8, 25000) ELSE max_price END
WHERE min_price IS NULL OR max_price IS NULL;

-- Seed some basic market factors for the next 365 days
INSERT INTO market_factors (location_id, dt, seasonality, demand)
SELECT 
  NULL as location_id, -- Global factors for now
  date_series.dt,
  -- Simple seasonality curve: winter lower, summer higher
  CASE 
    WHEN EXTRACT(MONTH FROM date_series.dt) IN (12, 1, 2) THEN 0.92  -- Winter
    WHEN EXTRACT(MONTH FROM date_series.dt) IN (3, 4, 5) THEN 0.97   -- Spring
    WHEN EXTRACT(MONTH FROM date_series.dt) IN (6, 7, 8) THEN 1.15   -- Summer
    ELSE 1.05  -- Fall
  END as seasonality,
  -- Weekend demand boost
  CASE 
    WHEN EXTRACT(DOW FROM date_series.dt) IN (5, 6) THEN 1.08  -- Fri, Sat
    WHEN EXTRACT(DOW FROM date_series.dt) = 0 THEN 1.05        -- Sun
    ELSE 1.0
  END as demand
FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '365 days', '1 day'::interval) AS date_series(dt)
ON CONFLICT (location_id, dt) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE pricing_rules IS 'Pricing rules and curves per room type';
COMMENT ON TABLE market_factors IS 'Market-level seasonality and demand factors';
COMMENT ON TABLE listing_prices IS 'Daily computed prices with override capability';
COMMENT ON TABLE pricing_audit IS 'Detailed breakdown of price calculations for transparency';
COMMENT ON FUNCTION occupancy_by_date IS 'Calculate occupancy percentage by date range for a room type';
