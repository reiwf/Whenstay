-- Smart Market Demand System Migration
-- This extends the existing pricing system with intelligent market demand calculation

-- 1. Extend market_factors table with auto/manual components
ALTER TABLE market_factors 
ADD COLUMN IF NOT EXISTS seasonality_auto DECIMAL(5,3),      -- learned/smoothed seasonality
ADD COLUMN IF NOT EXISTS demand_auto DECIMAL(5,3),           -- calculated demand nowcast
ADD COLUMN IF NOT EXISTS comp_pressure_auto DECIMAL(5,3) DEFAULT 1.00,  -- competitor pressure
ADD COLUMN IF NOT EXISTS manual_multiplier DECIMAL(5,3) DEFAULT 1.00,   -- admin override multiplier
ADD COLUMN IF NOT EXISTS lock_auto BOOLEAN DEFAULT FALSE,    -- prevent auto updates
ADD COLUMN IF NOT EXISTS manual_notes TEXT,                  -- admin notes for overrides

-- Audit/transparency fields for "why this price" breakdown
ADD COLUMN IF NOT EXISTS pickup_z DECIMAL(6,3),             -- pickup pace proxy score
ADD COLUMN IF NOT EXISTS availability_z DECIMAL(6,3),       -- availability pressure proxy
ADD COLUMN IF NOT EXISTS events_weight DECIMAL(6,3) DEFAULT 1.00, -- combined event weights
ADD COLUMN IF NOT EXISTS comp_price_z DECIMAL(6,3),         -- competitor price gap
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for updated_at field
CREATE INDEX IF NOT EXISTS idx_market_factors_updated_at ON market_factors(updated_at DESC);

-- 2. Holidays table - Admin-managed holidays and special dates
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  location_id UUID,                    -- NULL for global, or specific location
  dt DATE NOT NULL,
  tag TEXT NOT NULL,                   -- 'national', 'local', 'golden_week', etc
  weight DECIMAL(5,2) DEFAULT 1.05,    -- demand multiplier (e.g., 1.05 = +5%)
  title TEXT,                          -- display name
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, dt, tag)
);

-- 3. Events table - Conferences, festivals, local events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  location_id UUID,                    -- NULL for global, or specific location
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,              -- exclusive end date
  weight DECIMAL(5,2) DEFAULT 1.10,    -- demand multiplier (1.0-1.5 typical)
  description TEXT,
  url TEXT,                            -- reference link
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Competitor Sets - Group competitors by location/market
CREATE TABLE IF NOT EXISTS comp_sets (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  location_id UUID,                    -- associated location/property
  name TEXT NOT NULL DEFAULT 'Default',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, name)
);

-- 5. Competitor Members - Individual competitors in each set
CREATE TABLE IF NOT EXISTS comp_members (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  comp_set_id UUID NOT NULL REFERENCES comp_sets(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                -- 'manual', 'booking', 'airbnb', etc
  external_id TEXT,                    -- ID in source system (if applicable)
  label TEXT NOT NULL,                 -- display name like "Hotel Sakura"
  property_type TEXT,                  -- 'hotel', 'apartment', etc
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Competitor Daily Data - Manual price inputs and snapshots
CREATE TABLE IF NOT EXISTS comp_daily (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  comp_set_id UUID NOT NULL REFERENCES comp_sets(id) ON DELETE CASCADE,
  dt DATE NOT NULL,                    -- stay date
  lead_days INT,                       -- days between input and stay date (optional)
  price_median DECIMAL(10,2),          -- median price across active competitors
  price_p25 DECIMAL(10,2),             -- 25th percentile
  price_p75 DECIMAL(10,2),             -- 75th percentile
  price_min DECIMAL(10,2),             -- minimum price
  price_max DECIMAL(10,2),             -- maximum price
  sample_size INT DEFAULT 0,           -- number of competitors with data
  availability_pct DECIMAL(5,2),       -- % competitors still available (future feature)
  input_method TEXT DEFAULT 'manual',  -- 'manual', 'scrape', 'api'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comp_set_id, dt)
);

-- 7. Market Tuning - Configuration parameters for calculations
CREATE TABLE IF NOT EXISTS market_tuning (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  location_id UUID,                    -- NULL for global defaults
  
  -- Formula weights
  w_pickup DECIMAL(4,2) DEFAULT 0.40,   -- pickup pace weight
  w_avail DECIMAL(4,2) DEFAULT 0.30,    -- availability pressure weight  
  w_event DECIMAL(4,2) DEFAULT 0.30,    -- event impact weight
  
  -- Sensitivity parameters
  alpha DECIMAL(4,2) DEFAULT 0.12,      -- demand auto sensitivity (exp factor)
  beta DECIMAL(4,2) DEFAULT 0.10,       -- competitor pressure sensitivity
  
  -- Clamps and limits
  demand_min DECIMAL(4,2) DEFAULT 0.80,
  demand_max DECIMAL(4,2) DEFAULT 1.40,
  comp_pressure_min DECIMAL(4,2) DEFAULT 0.90,
  comp_pressure_max DECIMAL(4,2) DEFAULT 1.10,
  
  -- EMA smoothing
  ema_alpha DECIMAL(4,2) DEFAULT 0.30,  -- new weight in EMA (0.3 new, 0.7 old)
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_holidays_location_date ON holidays(location_id, dt) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_holidays_date_range ON holidays(dt) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_events_location_daterange ON events(location_id, start_date, end_date) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_events_daterange ON events(start_date, end_date) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_comp_sets_location ON comp_sets(location_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_comp_members_set_active ON comp_members(comp_set_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_comp_daily_set_date ON comp_daily(comp_set_id, dt);
CREATE INDEX IF NOT EXISTS idx_comp_daily_date_range ON comp_daily(dt);

-- Triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_holidays_updated_at ON holidays;
CREATE TRIGGER update_holidays_updated_at 
  BEFORE UPDATE ON holidays FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at 
  BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comp_sets_updated_at ON comp_sets;
CREATE TRIGGER update_comp_sets_updated_at 
  BEFORE UPDATE ON comp_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comp_members_updated_at ON comp_members;
CREATE TRIGGER update_comp_members_updated_at 
  BEFORE UPDATE ON comp_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_market_tuning_updated_at ON market_tuning;
CREATE TRIGGER update_market_tuning_updated_at 
  BEFORE UPDATE ON market_tuning FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_market_factors_updated_at ON market_factors;
CREATE TRIGGER update_market_factors_updated_at 
  BEFORE UPDATE ON market_factors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default market tuning parameters (global)
INSERT INTO market_tuning (location_id) 
SELECT NULL 
WHERE NOT EXISTS (SELECT 1 FROM market_tuning WHERE location_id IS NULL);

-- Create default competitor set for existing locations/properties
-- (This assumes you have a properties table - adjust if needed)
INSERT INTO comp_sets (location_id, name, description)
SELECT 
  p.location_id,
  'Default',
  'Default competitor set for ' || COALESCE(p.name, 'location')
FROM (
  SELECT DISTINCT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') 
         THEN (SELECT id FROM properties LIMIT 1)
         ELSE NULL 
    END as location_id,
    'Default Location' as name
) p
WHERE NOT EXISTS (SELECT 1 FROM comp_sets WHERE location_id = p.location_id OR (location_id IS NULL AND p.location_id IS NULL))
AND p.location_id IS NOT NULL;

-- Seed some common holidays (Japan-focused, adjust as needed)
INSERT INTO holidays (location_id, dt, tag, weight, title) VALUES
(NULL, '2024-01-01', 'national', 1.15, 'New Year'),
(NULL, '2024-01-08', 'national', 1.08, 'Coming of Age Day'),
(NULL, '2024-02-11', 'national', 1.05, 'National Foundation Day'),
(NULL, '2024-02-23', 'national', 1.05, 'Emperor''s Birthday'),
(NULL, '2024-03-20', 'national', 1.08, 'Vernal Equinox Day'),
(NULL, '2024-04-29', 'national', 1.10, 'Showa Day'),
(NULL, '2024-05-03', 'national', 1.12, 'Constitution Memorial Day'),
(NULL, '2024-05-04', 'national', 1.12, 'Greenery Day'),
(NULL, '2024-05-05', 'national', 1.12, 'Children''s Day'),
(NULL, '2024-07-15', 'national', 1.08, 'Marine Day'),
(NULL, '2024-08-11', 'national', 1.10, 'Mountain Day'),
(NULL, '2024-09-16', 'national', 1.08, 'Respect for the Aged Day'),
(NULL, '2024-09-23', 'national', 1.05, 'Autumnal Equinox Day'),
(NULL, '2024-10-14', 'national', 1.08, 'Sports Day'),
(NULL, '2024-11-03', 'national', 1.05, 'Culture Day'),
(NULL, '2024-11-23', 'national', 1.08, 'Labor Thanksgiving Day')
ON CONFLICT (location_id, dt, tag) DO NOTHING;

-- Add 2025 holidays
INSERT INTO holidays (location_id, dt, tag, weight, title) VALUES

(NULL, '2025-01-13', 'national', 1.08, 'Coming of Age Day'),
(NULL, '2025-02-11', 'national', 1.05, 'National Foundation Day'),
(NULL, '2025-02-23', 'national', 1.05, 'Emperor''s Birthday'),
(NULL, '2025-03-20', 'national', 1.08, 'Vernal Equinox Day'),
(NULL, '2025-04-29', 'national', 1.10, 'Showa Day'),
(NULL, '2025-05-03', 'national', 1.12, 'Constitution Memorial Day'),
(NULL, '2025-05-04', 'national', 1.12, 'Greenery Day'),
(NULL, '2025-05-05', 'national', 1.12, 'Children''s Day'),
(NULL, '2025-07-21', 'national', 1.08, 'Marine Day'),
(NULL, '2025-08-11', 'national', 1.10, 'Mountain Day'),
(NULL, '2025-09-15', 'national', 1.08, 'Respect for the Aged Day'),
(NULL, '2025-09-23', 'national', 1.05, 'Autumnal Equinox Day'),
(NULL, '2025-10-13', 'national', 1.08, 'Sports Day'),
(NULL, '2025-11-03', 'national', 1.05, 'Culture Day'),
(NULL, '2025-11-23', 'national', 1.08, 'Labor Thanksgiving Day'),
(NULL, '2025-12-30', 'national', 1.15, 'New Year EVE'),
(NULL, '2025-12-31', 'national', 1.15, 'New Year EVE')
ON CONFLICT (location_id, dt, tag) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE holidays IS 'Admin-managed holidays and special dates affecting demand';
COMMENT ON TABLE events IS 'Conferences, festivals, and local events affecting demand';
COMMENT ON TABLE comp_sets IS 'Competitor groupings by location or market segment';
COMMENT ON TABLE comp_members IS 'Individual competitors tracked in each set';
COMMENT ON TABLE comp_daily IS 'Daily competitor price data (manual input)';
COMMENT ON TABLE market_tuning IS 'Configuration parameters for market demand calculations';

COMMENT ON COLUMN market_factors.seasonality_auto IS 'Auto-calculated seasonality factor (learned/smoothed)';
COMMENT ON COLUMN market_factors.demand_auto IS 'Auto-calculated demand factor from pickup/availability/events';
COMMENT ON COLUMN market_factors.comp_pressure_auto IS 'Auto-calculated competitor pressure factor';
COMMENT ON COLUMN market_factors.manual_multiplier IS 'Admin manual override multiplier (default 1.0)';
COMMENT ON COLUMN market_factors.lock_auto IS 'Prevent automatic updates when true';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Smart Market Demand System migration completed successfully';
  RAISE NOTICE 'Tables created: holidays, events, comp_sets, comp_members, comp_daily, market_tuning';
  RAISE NOTICE 'Market_factors table extended with auto/manual fields';
  RAISE NOTICE 'Default tuning parameters and Japan holidays seeded';
END
$$;
