-- Migration: Remove template_id column from message_rules after junction table migration
-- This completes the transition to Many-to-Many relationship

-- Verify that all existing template relationships have been migrated
DO $$
DECLARE
    unmigrated_count integer;
BEGIN
    SELECT COUNT(*) INTO unmigrated_count
    FROM public.message_rules mr
    WHERE mr.template_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.message_rule_templates mrt 
        WHERE mrt.rule_id = mr.id AND mrt.template_id = mr.template_id
    );
    
    IF unmigrated_count > 0 THEN
        RAISE EXCEPTION 'Found % unmigrated template relationships. Migration cannot proceed.', unmigrated_count;
    END IF;
    
    RAISE NOTICE 'Data migration verification passed. All template relationships have been migrated.';
END $$;

-- Remove the foreign key constraint first
ALTER TABLE public.message_rules DROP CONSTRAINT IF EXISTS message_rules_template_id_fkey;

-- Remove the template_id column
ALTER TABLE public.message_rules DROP COLUMN IF EXISTS template_id;

-- Update the view that might reference template_id (if it exists)
DROP VIEW IF EXISTS public.message_rules_with_channel;

-- Recreate the view to use the new junction table
CREATE VIEW public.message_rules_with_channel AS
SELECT 
    mr.id,
    mr.code,
    mr.name,
    mr.type,
    mr.days,
    mr.hours,
    mr.at_time,
    mr.delay_minutes,
    mr.backfill,
    mr.enabled,
    mr.timezone,
    mr.property_id,
    mr.created_at,
    mr.updated_at,
    -- Get primary template info for backward compatibility
    pt.id as template_id,
    pt.channel,
    pt.name as template_name,
    pt.content as template_content,
    pt.language as template_language
FROM public.message_rules mr
LEFT JOIN public.message_rule_templates mrt ON mr.id = mrt.rule_id AND mrt.is_primary = true
LEFT JOIN public.message_templates pt ON mrt.template_id = pt.id;

COMMENT ON VIEW public.message_rules_with_channel IS 'Updated view showing message rules with their primary template information for backward compatibility';

-- Add helpful comment
COMMENT ON TABLE public.message_rules IS 'Message rules now use Many-to-Many relationship with templates via message_rule_templates junction table';
