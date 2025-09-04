-- Fix Message Rules Channel Architecture Migration
-- This migration removes the channel column from message_rules table
-- Templates become the single source of truth for message channels

-- 1. First, validate that all rules have templates with valid channels
DO $$
DECLARE
    orphaned_rules INTEGER;
    rules_without_template_channel INTEGER;
BEGIN
    -- Check for rules without templates
    SELECT COUNT(*) INTO orphaned_rules
    FROM message_rules mr
    LEFT JOIN message_templates mt ON mr.template_id = mt.id
    WHERE mt.id IS NULL;
    
    IF orphaned_rules > 0 THEN
        RAISE EXCEPTION 'Found % message rules without valid templates. Cannot proceed with migration.', orphaned_rules;
    END IF;
    
    -- Check for rules with templates that don't have channels
    SELECT COUNT(*) INTO rules_without_template_channel
    FROM message_rules mr
    JOIN message_templates mt ON mr.template_id = mt.id
    WHERE mt.channel IS NULL OR mt.channel = '';
    
    IF rules_without_template_channel > 0 THEN
        RAISE EXCEPTION 'Found % message rules with templates that have no channel defined. Cannot proceed with migration.', rules_without_template_channel;
    END IF;
    
    RAISE NOTICE 'Pre-migration validation passed. All rules have valid templates with channels.';
END $$;

-- 2. Create a backup view of the current state for rollback if needed
CREATE OR REPLACE VIEW message_rules_channel_backup AS
SELECT 
    mr.id,
    mr.code,
    mr.name,
    mr.channel as old_rule_channel,
    mt.channel as template_channel,
    mr.template_id,
    mr.enabled
FROM message_rules mr
JOIN message_templates mt ON mr.template_id = mt.id;

-- 3. Log the current state for verification
DO $$
DECLARE
    channel_mismatches INTEGER;
    rec RECORD;
BEGIN
    -- Count any mismatches between rule channel and template channel
    SELECT COUNT(*) INTO channel_mismatches
    FROM message_rules mr
    JOIN message_templates mt ON mr.template_id = mt.id
    WHERE mr.channel != mt.channel;
    
    IF channel_mismatches > 0 THEN
        RAISE WARNING 'Found % rule-template pairs with different channels. This migration will resolve these conflicts by using template channels.', channel_mismatches;
        
        -- Log the mismatches for review
        RAISE NOTICE 'Channel mismatches found:';
        FOR rec IN 
            SELECT mr.code, mr.name, mr.channel as rule_channel, mt.channel as template_channel
            FROM message_rules mr
            JOIN message_templates mt ON mr.template_id = mt.id
            WHERE mr.channel != mt.channel
        LOOP
            RAISE NOTICE 'Rule %: % (rule: %, template: %)', rec.code, rec.name, rec.rule_channel, rec.template_channel;
        END LOOP;
    ELSE
        RAISE NOTICE 'All rule-template pairs have matching channels. Migration will be clean.';
    END IF;
END $$;

-- 4. Update any scheduled_messages that might reference the old rule channel
-- This ensures consistency for existing scheduled messages
UPDATE scheduled_messages sm
SET channel = mt.channel
FROM message_rules mr
JOIN message_templates mt ON mr.template_id = mt.id  
WHERE sm.rule_id = mr.id
  AND sm.template_id = mt.id
  AND sm.channel != mt.channel;

-- 5. Drop the channel constraint and column from message_rules
ALTER TABLE message_rules 
DROP CONSTRAINT IF EXISTS message_rules_channel_check;

-- Remove the channel column
ALTER TABLE message_rules 
DROP COLUMN IF EXISTS channel;

-- 6. Update the database comments
COMMENT ON TABLE message_rules IS 'Admin-configurable message rules for automated scheduling based on reservation events. Channel is determined by the associated template.';
COMMENT ON COLUMN message_rules.template_id IS 'References message_templates which defines the channel, content, and format for this rule';

-- 7. Create a view to easily access rule information with channel from template
CREATE OR REPLACE VIEW message_rules_with_channel AS
SELECT 
    mr.*,
    mt.channel,
    mt.name as template_name,
    mt.content as template_content,
    mt.language as template_language
FROM message_rules mr
JOIN message_templates mt ON mr.template_id = mt.id;

-- 8. Create indexes for the new query patterns
CREATE INDEX IF NOT EXISTS idx_message_templates_channel 
ON message_templates(channel) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_message_rules_template_enabled 
ON message_rules(template_id, enabled) WHERE enabled = true;

-- 9. Update the generator service function signature documentation
COMMENT ON FUNCTION generate_idempotency_key IS 'Generates consistent idempotency keys for preventing duplicate scheduled messages. Channel is now determined by template.';

-- 10. Verify the migration was successful
DO $$
DECLARE
    remaining_channel_cols INTEGER;
    total_rules INTEGER;
    rules_with_templates INTEGER;
BEGIN
    -- Check if channel column was removed
    SELECT COUNT(*) INTO remaining_channel_cols
    FROM information_schema.columns 
    WHERE table_name = 'message_rules' 
      AND column_name = 'channel'
      AND table_schema = 'public';
    
    IF remaining_channel_cols > 0 THEN
        RAISE EXCEPTION 'Channel column still exists in message_rules table. Migration failed.';
    END IF;
    
    -- Verify all rules still have valid templates
    SELECT COUNT(*) INTO total_rules FROM message_rules;
    
    SELECT COUNT(*) INTO rules_with_templates
    FROM message_rules mr
    JOIN message_templates mt ON mr.template_id = mt.id
    WHERE mt.channel IS NOT NULL;
    
    IF total_rules != rules_with_templates THEN
        RAISE EXCEPTION 'Rule-template validation failed after migration. Expected %, got %', total_rules, rules_with_templates;
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Removed channel column from message_rules table';
    RAISE NOTICE 'All % rules have valid templates with channels', total_rules;
    RAISE NOTICE 'Created message_rules_with_channel view for easy access';
END $$;

-- Migration complete!
SELECT 'Message Rules Channel Architecture Migration Complete' as status,
       COUNT(*) as total_rules,
       COUNT(DISTINCT mt.channel) as unique_channels
FROM message_rules mr
JOIN message_templates mt ON mr.template_id = mt.id;
