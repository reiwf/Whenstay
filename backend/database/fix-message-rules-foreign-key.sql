-- Fix foreign key constraint migration
-- This migration updates scheduled_messages.rule_id to reference message_rules instead of automation_rules
-- Completes the transition from old automation_rules architecture to new message_rules architecture

-- 1. Drop the old foreign key constraint pointing to automation_rules
ALTER TABLE scheduled_messages 
  DROP CONSTRAINT IF EXISTS scheduled_messages_rule_id_fkey;

-- 2. Drop the old constraint pointing to automation_rules (in case it has a different name)
ALTER TABLE scheduled_messages 
  DROP CONSTRAINT IF EXISTS fk_scheduled_messages_rule_id;

-- 3. Clean up any orphaned scheduled_messages that reference non-existent rule_ids
-- First, identify and handle orphaned records
WITH orphaned_messages AS (
  SELECT sm.id, sm.rule_id
  FROM scheduled_messages sm
  WHERE sm.rule_id IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM message_rules mr WHERE mr.id = sm.rule_id
    )
)
UPDATE scheduled_messages 
SET rule_id = NULL, 
    last_error = 'Orphaned rule_id cleaned up during migration',
    updated_at = now()
WHERE id IN (SELECT id FROM orphaned_messages);

-- 4. Add new foreign key constraint pointing to message_rules
ALTER TABLE scheduled_messages 
  ADD CONSTRAINT scheduled_messages_rule_id_fkey 
  FOREIGN KEY (rule_id) REFERENCES message_rules(id) ON DELETE SET NULL;

-- 5. Update the indexes to reflect the new constraint
-- Drop old index if it exists
DROP INDEX IF EXISTS idx_scheduled_messages_rule_reservation_queued;

-- Create new optimized indexes for the message_rules architecture
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_rule_id 
  ON scheduled_messages(rule_id) WHERE rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_reservation_rule_status 
  ON scheduled_messages(reservation_id, rule_id, status) 
  WHERE reservation_id IS NOT NULL AND rule_id IS NOT NULL;

-- 6. Update any database functions that might reference the old constraint
-- Update the cancel function comment to reflect new architecture
COMMENT ON FUNCTION cancel_pending_for_reservation IS 
  'Cancels all pending/processing scheduled messages for a reservation using new message_rules architecture';

-- 7. Add validation to ensure rule_id references are valid
-- This is now handled by the foreign key constraint, but add a comment for clarity
COMMENT ON COLUMN scheduled_messages.rule_id IS 
  'References message_rules.id (new architecture) - replaces old automation_rules reference';

-- 8. Provide summary of migration changes
SELECT 
  'Foreign Key Constraint Migration Complete' as status,
  (SELECT COUNT(*) FROM scheduled_messages WHERE rule_id IS NOT NULL) as messages_with_rules,
  (SELECT COUNT(*) FROM message_rules WHERE enabled = true) as active_message_rules,
  (SELECT COUNT(*) FROM scheduled_messages WHERE rule_id IS NULL) as messages_without_rules;

-- Migration complete!
SELECT 'Message Rules Foreign Key Migration Complete' as final_status;
