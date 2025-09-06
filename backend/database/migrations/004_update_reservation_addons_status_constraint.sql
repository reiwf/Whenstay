-- Migration: Update reservation_addons status constraint to include refund statuses
-- Purpose: Fix database constraint violation when processing refunds
-- Date: 2025-09-06

-- Drop the existing constraint
ALTER TABLE reservation_addons DROP CONSTRAINT IF EXISTS reservation_addons_status_check;

-- Add the updated constraint with refund status values
ALTER TABLE reservation_addons ADD CONSTRAINT reservation_addons_status_check 
CHECK (purchase_status IN (
  'available',
  'pending', 
  'paid',
  'failed',
  'exempted',
  'refunded',
  'partially_refunded'
));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT reservation_addons_status_check ON reservation_addons IS 
'Validates purchase_status values: available, pending, paid, failed, exempted, refunded, partially_refunded';
