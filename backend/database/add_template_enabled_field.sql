-- Add enabled field to message_templates table
-- This allows individual templates to be turned on/off for automation

-- Add the enabled column (defaults to true for existing templates)
ALTER TABLE public.message_templates 
ADD COLUMN enabled boolean NOT NULL DEFAULT true;

-- Add an index for performance when filtering by enabled status
CREATE INDEX idx_message_templates_enabled ON public.message_templates (enabled);

-- Add a comment to document the purpose
COMMENT ON COLUMN public.message_templates.enabled IS 'Controls whether this template is active for automation scheduling. When false, templates are completely skipped during automation processing.';

-- Update any existing sample templates to ensure they are enabled
UPDATE public.message_templates SET enabled = true WHERE enabled IS NULL;
