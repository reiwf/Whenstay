-- Migration: Create Many-to-Many relationship between message_rules and message_templates
-- This replaces the direct template_id foreign key in message_rules

-- Create the junction table
CREATE TABLE public.message_rule_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    rule_id uuid NOT NULL,
    template_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    
    CONSTRAINT message_rule_templates_pkey PRIMARY KEY (id),
    CONSTRAINT message_rule_templates_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.message_rules(id) ON DELETE CASCADE,
    CONSTRAINT message_rule_templates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.message_templates(id) ON DELETE CASCADE,
    
    -- Ensure each rule has only one primary template
    CONSTRAINT unique_primary_per_rule EXCLUDE (rule_id WITH =) WHERE (is_primary = true),
    
    -- Prevent duplicate rule-template combinations
    CONSTRAINT unique_rule_template UNIQUE (rule_id, template_id)
);

-- Create indexes for performance
CREATE INDEX idx_message_rule_templates_rule_id ON public.message_rule_templates USING btree (rule_id);
CREATE INDEX idx_message_rule_templates_template_id ON public.message_rule_templates USING btree (template_id);
CREATE INDEX idx_message_rule_templates_primary ON public.message_rule_templates USING btree (rule_id, is_primary) WHERE (is_primary = true);

-- Add updated_at trigger
CREATE TRIGGER trg_message_rule_templates_updated_at 
    BEFORE UPDATE ON public.message_rule_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from message_rules.template_id to junction table
-- This preserves existing rule-template relationships as primary templates
INSERT INTO public.message_rule_templates (rule_id, template_id, is_primary, priority)
SELECT 
    mr.id as rule_id,
    mr.template_id,
    true as is_primary,  -- Existing templates become primary
    1 as priority
FROM public.message_rules mr
WHERE mr.template_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE public.message_rule_templates IS 'Junction table for Many-to-Many relationship between message rules and templates. Allows multiple templates per rule for different channels/languages.';
COMMENT ON COLUMN public.message_rule_templates.is_primary IS 'Indicates the default/fallback template for this rule when no specific match is found';
COMMENT ON COLUMN public.message_rule_templates.priority IS 'Higher priority templates are preferred when multiple templates match the same criteria';

-- After migration is complete, the template_id column can be removed from message_rules
-- This will be done in a separate migration to ensure data safety
