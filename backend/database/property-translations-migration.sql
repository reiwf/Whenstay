-- Property Translations Migration
-- This creates a separate table for storing property field translations

-- Create property_translations table
CREATE TABLE IF NOT EXISTS property_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    field_name VARCHAR(50) NOT NULL, -- 'house_rules', 'description', 'luggage_info', 'check_in_instructions'
    language_code VARCHAR(5) NOT NULL, -- 'en', 'ja', 'ko', 'zh-CN', 'zh-TW'
    translated_text TEXT NOT NULL,
    is_auto_translated BOOLEAN DEFAULT false, -- track if AI-generated
    is_approved BOOLEAN DEFAULT false, -- manual review status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Ensure unique combination of property, field, and language
    UNIQUE(property_id, field_name, language_code)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_translations_property_language 
ON property_translations(property_id, language_code);

CREATE INDEX IF NOT EXISTS idx_property_translations_field 
ON property_translations(property_id, field_name);

CREATE INDEX IF NOT EXISTS idx_property_translations_status 
ON property_translations(property_id, is_approved);

-- Add RLS (Row Level Security) policies
ALTER TABLE property_translations ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read translations
CREATE POLICY "Users can view property translations" ON property_translations
    FOR SELECT USING (true);

-- Policy for property owners to manage their property translations
CREATE POLICY "Property owners can manage translations" ON property_translations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM properties 
            WHERE properties.id = property_translations.property_id 
            AND properties.owner_id = auth.uid()
        )
    );

-- Policy for admin users to manage all translations
CREATE POLICY "Admins can manage all translations" ON property_translations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.role = 'admin'
        )
    );

-- Create helper function to get translated text with fallback
CREATE OR REPLACE FUNCTION get_translated_text(
    p_property_id UUID,
    p_field_name VARCHAR,
    p_language_code VARCHAR DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE
    translated_text TEXT;
    fallback_text TEXT;
BEGIN
    -- Try to get translation in requested language
    SELECT pt.translated_text INTO translated_text
    FROM property_translations pt
    WHERE pt.property_id = p_property_id
      AND pt.field_name = p_field_name
      AND pt.language_code = p_language_code;
    
    -- If translation found, return it
    IF translated_text IS NOT NULL THEN
        RETURN translated_text;
    END IF;
    
    -- Fallback to English if not found
    IF p_language_code != 'en' THEN
        SELECT pt.translated_text INTO translated_text
        FROM property_translations pt
        WHERE pt.property_id = p_property_id
          AND pt.field_name = p_field_name
          AND pt.language_code = 'en';
        
        IF translated_text IS NOT NULL THEN
            RETURN translated_text;
        END IF;
    END IF;
    
    -- Final fallback to original property field
    CASE p_field_name
        WHEN 'house_rules' THEN
            SELECT house_rules INTO fallback_text FROM properties WHERE id = p_property_id;
        WHEN 'description' THEN
            SELECT description INTO fallback_text FROM properties WHERE id = p_property_id;
        WHEN 'luggage_info' THEN
            SELECT luggage_info INTO fallback_text FROM properties WHERE id = p_property_id;
        WHEN 'check_in_instructions' THEN
            SELECT check_in_instructions INTO fallback_text FROM properties WHERE id = p_property_id;
    END CASE;
    
    RETURN COALESCE(fallback_text, '');
END;
$$ LANGUAGE plpgsql;

-- Create function to upsert translation
CREATE OR REPLACE FUNCTION upsert_property_translation(
    p_property_id UUID,
    p_field_name VARCHAR,
    p_language_code VARCHAR,
    p_translated_text TEXT,
    p_is_auto_translated BOOLEAN DEFAULT false,
    p_created_by UUID DEFAULT auth.uid()
) RETURNS UUID AS $$
DECLARE
    translation_id UUID;
BEGIN
    INSERT INTO property_translations (
        property_id,
        field_name,
        language_code,
        translated_text,
        is_auto_translated,
        created_by,
        updated_at
    ) VALUES (
        p_property_id,
        p_field_name,
        p_language_code,
        p_translated_text,
        p_is_auto_translated,
        p_created_by,
        NOW()
    )
    ON CONFLICT (property_id, field_name, language_code)
    DO UPDATE SET
        translated_text = EXCLUDED.translated_text,
        is_auto_translated = EXCLUDED.is_auto_translated,
        updated_at = NOW(),
        created_by = COALESCE(EXCLUDED.created_by, property_translations.created_by)
    RETURNING id INTO translation_id;
    
    RETURN translation_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default English translations from existing property data
INSERT INTO property_translations (property_id, field_name, language_code, translated_text, is_approved)
SELECT 
    id as property_id,
    'house_rules' as field_name,
    'en' as language_code,
    house_rules as translated_text,
    true as is_approved
FROM properties 
WHERE house_rules IS NOT NULL AND house_rules != ''
ON CONFLICT DO NOTHING;

INSERT INTO property_translations (property_id, field_name, language_code, translated_text, is_approved)
SELECT 
    id as property_id,
    'description' as field_name,
    'en' as language_code,
    description as translated_text,
    true as is_approved
FROM properties 
WHERE description IS NOT NULL AND description != ''
ON CONFLICT DO NOTHING;

INSERT INTO property_translations (property_id, field_name, language_code, translated_text, is_approved)
SELECT 
    id as property_id,
    'luggage_info' as field_name,
    'en' as language_code,
    luggage_info as translated_text,
    true as is_approved
FROM properties 
WHERE luggage_info IS NOT NULL AND luggage_info != ''
ON CONFLICT DO NOTHING;

INSERT INTO property_translations (property_id, field_name, language_code, translated_text, is_approved)
SELECT 
    id as property_id,
    'check_in_instructions' as field_name,
    'en' as language_code,
    check_in_instructions as translated_text,
    true as is_approved
FROM properties 
WHERE check_in_instructions IS NOT NULL AND check_in_instructions != ''
ON CONFLICT DO NOTHING;

-- Create view for easy translation access
CREATE OR REPLACE VIEW property_translations_view AS
SELECT 
    p.id as property_id,
    p.name as property_name,
    pt.field_name,
    pt.language_code,
    pt.translated_text,
    pt.is_auto_translated,
    pt.is_approved,
    pt.created_at,
    pt.updated_at,
    u.email as created_by_email
FROM properties p
LEFT JOIN property_translations pt ON p.id = pt.property_id
LEFT JOIN auth.users u ON pt.created_by = u.id
WHERE p.is_active = true;

COMMENT ON TABLE property_translations IS 'Stores translations for property text fields in multiple languages';
COMMENT ON FUNCTION get_translated_text IS 'Helper function to retrieve translated text with fallback logic';
COMMENT ON FUNCTION upsert_property_translation IS 'Function to insert or update property translations';
