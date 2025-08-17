-- Fix Market Factors NULL Duplicates Migration
-- This migration addresses the PostgreSQL NULL constraint issue
-- where NULL != NULL allows duplicate records

-- Step 1: Update existing NULL location_id records to use a global UUID
UPDATE market_factors 
SET location_id = '00000000-0000-0000-0000-000000000000' 
WHERE location_id IS NULL;

-- Step 2: Remove any duplicate records that may have been created
-- Keep only the most recent record for each date with the global UUID
DELETE FROM market_factors a 
USING market_factors b 
WHERE a.id > b.id 
  AND a.location_id = '00000000-0000-0000-0000-000000000000' 
  AND a.dt = b.dt
  AND a.location_id = b.location_id;

-- Step 3: Verify the cleanup
-- This should show unique records per date for the global UUID
SELECT 
  location_id,
  dt,
  COUNT(*) as record_count
FROM market_factors 
WHERE location_id = '00000000-0000-0000-0000-000000000000'
GROUP BY location_id, dt
HAVING COUNT(*) > 1;

-- If the above query returns any rows, there are still duplicates that need manual cleanup

-- Step 4: Add a comment to document the global UUID usage
COMMENT ON TABLE market_factors IS 'Market demand factors table. Uses 00000000-0000-0000-0000-000000000000 as global location_id for fallback factors.';
