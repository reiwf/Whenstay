-- Rollback Migration: Convert reservations.status from TEXT back to enum
-- Date: 2025-08-19
-- Purpose: Rollback the enum to TEXT migration if needed

BEGIN;

-- Step 1: Recreate the enum type if it was dropped
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE public.reservation_status AS ENUM (
            'pending', 'invited', 'completed', 'cancelled', 
            'confirmed', 'checked_in', 'checked_out', 'no_show', 'new'
        );
    END IF;
END $$;

-- Step 2: Add a new temporary enum column
ALTER TABLE public.reservations 
ADD COLUMN status_temp public.reservation_status;

-- Step 3: Copy all data from TEXT column to enum column
UPDATE public.reservations 
SET status_temp = status::public.reservation_status;

-- Step 4: Add NOT NULL constraint
ALTER TABLE public.reservations 
ALTER COLUMN status_temp SET NOT NULL;

-- Step 5: Drop the TEXT column and constraints
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_status_temp_check;

ALTER TABLE public.reservations 
DROP COLUMN status;

-- Step 6: Rename the new enum column to replace the old one
ALTER TABLE public.reservations 
RENAME COLUMN status_temp TO status;

-- Step 7: Recreate indexes
DROP INDEX IF EXISTS idx_reservations_status;
CREATE INDEX idx_reservations_status ON public.reservations(status);

DROP INDEX IF EXISTS idx_reservations_status_date;
CREATE INDEX idx_reservations_status_date ON public.reservations(status, check_in_date);

-- Step 8: Update views back to enum-aware versions if needed
-- The reservations_details view should adapt automatically

COMMIT;

-- Verification queries (run these after the rollback to verify success)
-- SELECT DISTINCT status FROM public.reservations ORDER BY status;
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'status';
-- SELECT typname FROM pg_type WHERE typname = 'reservation_status';
