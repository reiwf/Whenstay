-- Fix scheduled_messages foreign key constraint to point to message_rules instead of automation_rules
-- This migration fixes the PGRST200 error by updating the foreign key relationship

BEGIN;

-- 1. Drop the old foreign key constraint pointing to automation_rules
ALTER TABLE scheduled_messages 
DROP CONSTRAINT IF EXISTS scheduled_messages_rule_id_fkey;

-- 2. Drop the old foreign key constraint with alternate name (if exists)
ALTER TABLE scheduled_messages 
DROP CONSTRAINT IF EXISTS fk_scheduled_messages_rule_id;

-- 3. Add new foreign key constraint pointing to message_rules
ALTER TABLE scheduled_messages 
ADD CONSTRAINT scheduled_messages_rule_id_fkey 
FOREIGN KEY (rule_id) REFERENCES message_rules(id) ON DELETE SET NULL;

-- 4. Create index for performance on the new foreign key
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_rule_id 
ON scheduled_messages(rule_id) 
WHERE rule_id IS NOT NULL;

-- 5. Verify the constraint was created correctly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'scheduled_messages_rule_id_fkey' 
        AND table_name = 'scheduled_messages'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        RAISE EXCEPTION 'Foreign key constraint was not created successfully';
    END IF;
    
    RAISE NOTICE 'Foreign key constraint updated successfully: scheduled_messages.rule_id now references message_rules.id';
END
$$;

COMMIT;

-- Report status
SELECT 'scheduled_messages foreign key constraint updated to reference message_rules' as migration_status;
