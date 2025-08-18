-- Migration: Remove seasonality columns from market_factors table
-- Seasonality is now handled directly via seasonality_settings table in pricing service

-- Remove seasonality columns from market_factors table
ALTER TABLE market_factors 
DROP COLUMN IF EXISTS seasonality_auto,
DROP COLUMN IF EXISTS seasonality;

-- Add comment to clarify the change
COMMENT ON TABLE market_factors IS 'Market demand factors (seasonality handled separately via seasonality_settings table)';

-- Optional: Clean up any existing seasonality data in case there are references
-- This ensures a clean separation between market factors and seasonality
UPDATE market_factors 
SET updated_at = NOW() 
WHERE updated_at IS NOT NULL;

-- Add helpful comment about the change
COMMENT ON COLUMN market_factors.demand IS 'Final effective demand factor (excluding seasonality which is now handled in pricing service)';
COMMENT ON COLUMN market_factors.demand_auto IS 'Auto-calculated demand factor from market signals (pickup, availability, events)';
