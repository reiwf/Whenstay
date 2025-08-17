-- Pricing Audit Enhancement Migration
-- Adds enhanced smart market demand columns to pricing_audit table

-- Add new columns to pricing_audit table for enhanced market factors
ALTER TABLE pricing_audit 
ADD COLUMN IF NOT EXISTS comp_pressure DECIMAL(4,3) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS manual_multiplier DECIMAL(4,3) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS events_weight DECIMAL(4,3) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS pickup_signal DECIMAL(6,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS availability_signal DECIMAL(6,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS comp_price_signal DECIMAL(6,3) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN pricing_audit.comp_pressure IS 'Competitor pressure factor from smart market demand';
COMMENT ON COLUMN pricing_audit.manual_multiplier IS 'Manual override multiplier';
COMMENT ON COLUMN pricing_audit.events_weight IS 'Combined events and holidays weight';
COMMENT ON COLUMN pricing_audit.pickup_signal IS 'Pickup pace proxy signal (recent bookings velocity)';
COMMENT ON COLUMN pricing_audit.availability_signal IS 'Availability pressure signal (negative availability proxy)';
COMMENT ON COLUMN pricing_audit.comp_price_signal IS 'Competitor price gap signal';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Pricing audit enhancement completed successfully';
  RAISE NOTICE 'Added enhanced smart market demand columns to pricing_audit table';
END
$$;
