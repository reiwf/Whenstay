-- Migration: Add seasonality_settings table for configurable seasonal pricing
-- This allows users to define custom seasons with adjustable date ranges and multipliers

-- Create seasonality_settings table
CREATE TABLE IF NOT EXISTS seasonality_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    season_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    multiplier DECIMAL(5,3) NOT NULL CHECK (multiplier > 0),
    year_recurring BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to prevent overlapping seasons for same location
CREATE UNIQUE INDEX idx_seasonality_location_order ON seasonality_settings(location_id, display_order) WHERE is_active = true;

-- Create index for efficient lookups
CREATE INDEX idx_seasonality_location_active ON seasonality_settings(location_id, is_active) WHERE is_active = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_seasonality_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_seasonality_settings_updated_at
    BEFORE UPDATE ON seasonality_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_seasonality_settings_updated_at();

-- Insert default seasonality settings for global use (location_id = NULL)
-- Using representative dates for each season (recurring annually)
INSERT INTO seasonality_settings (location_id, season_name, start_date, end_date, multiplier, year_recurring, display_order) VALUES
    (NULL, 'Winter', '2024-12-01', '2025-02-28', 0.92, true, 1),
    (NULL, 'Spring', '2024-03-01', '2024-05-31', 0.97, true, 2), 
    (NULL, 'Summer', '2024-06-01', '2024-08-31', 1.15, true, 3),
    (NULL, 'Fall', '2024-09-01', '2024-11-30', 1.05, true, 4)
ON CONFLICT DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE seasonality_settings IS 'Configurable seasonal pricing multipliers with custom date ranges';
COMMENT ON COLUMN seasonality_settings.location_id IS 'NULL for global settings, specific location_id for location overrides';
COMMENT ON COLUMN seasonality_settings.start_date IS 'Start date of seasonal period (DATE)';
COMMENT ON COLUMN seasonality_settings.end_date IS 'End date of seasonal period (DATE), inclusive';
COMMENT ON COLUMN seasonality_settings.year_recurring IS 'If true, applies to same date range every year';
COMMENT ON COLUMN seasonality_settings.multiplier IS 'Seasonal pricing multiplier (e.g., 1.15 = 15% increase)';
COMMENT ON COLUMN seasonality_settings.display_order IS 'Order for UI display and conflict resolution';
