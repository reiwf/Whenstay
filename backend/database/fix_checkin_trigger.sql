-- Fix for check-in submission error
-- Remove the trigger that automatically changes reservation status during check-in updates

-- Drop the problematic trigger that tries to set invalid status values
DROP TRIGGER IF EXISTS update_reservations_checkin_status ON reservations;

-- Drop the function if it exists (it may be trying to set status to 'submitted' which is invalid)
DROP FUNCTION IF EXISTS update_checkin_status();

-- Note: We're removing this trigger because:
-- 1. It tries to set status to 'submitted' which is not a valid enum value
-- 2. We want to preserve manual control over reservation status
-- 3. Check-in completion should be tracked via checkin_submitted_at field, not status
