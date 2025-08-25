-- Room Type Translations Migration
-- This creates a separate table for storing room type field translations

-- Create room_type_translations table
CREATE TABLE IF NOT EXISTS room_type_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    field_name VARCHAR(50) NOT NULL, -- 'name', 'description', 'bed_configuration'
    language_code VARCHAR(5) NOT NULL, -- 'en', 'ja', 'ko', 'zh-CN', 'zh-TW'
    translated_text TEXT NOT NULL,
    is_auto_translated BOOLEAN DEFAULT false, -- track if AI-generated
    is_approved BOOLEAN DEFAULT false, -- manual review status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Ensure unique combination of room_type, field, and language
    UNIQUE(room_type_id, field_name, language_code)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_type_translations_room_type_language 
ON room_type_translations(room_type_id, language_code);

CREATE INDEX IF NOT EXISTS idx_room_type_translations_field 
ON room_type_translations(room_type_id, field_name);

CREATE INDEX IF NOT EXISTS idx_room_type_translations_status 
ON room_type_translations(room_type_id, is_approved);

-- Add RLS (Row Level Security) policies
ALTER TABLE room_type_translations ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read translations
CREATE POLICY "Users can view room type translations" ON room_type_translations
    FOR SELECT USING (true);

-- Policy for property owners to manage their room type translations
CREATE POLICY "Property owners can manage room type translations" ON room_type_translations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM room_types rt
            JOIN properties p ON rt.property_id = p.id
            WHERE rt.id = room_type_translations.room_type_id 
            AND p.owner_id = auth.uid()
        )
    );

-- Policy for admin users to manage all translations
CREATE POLICY "Admins can manage all room type translations" ON room_type_translations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.role = 'admin'
        )
    );

-- Create helper function to get translated text with fallback
CREATE OR REPLACE FUNCTION get_room_type_translated_text(
    p_room_type_id UUID,
    p_field_name VARCHAR,
    p_language_code VARCHAR DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE
    translated_text TEXT;
    fallback_text TEXT;
BEGIN
    -- Try to get translation in requested language
    SELECT rt.translated_text INTO translated_text
    FROM room_type_translations rt
    WHERE rt.room_type_id = p_room_type_id
      AND rt.field_name = p_field_name
      AND rt.language_code = p_language_code;
    
    -- If translation found, return it
    IF translated_text IS NOT NULL THEN
        RETURN translated_text;
    END IF;
    
    -- Fallback to English if not found
    IF p_language_code != 'en' THEN
        SELECT rt.translated_text INTO translated_text
        FROM room_type_translations rt
        WHERE rt.room_type_id = p_room_type_id
          AND rt.field_name = p_field_name
          AND rt.language_code = 'en';
        
        IF translated_text IS NOT NULL THEN
            RETURN translated_text;
        END IF;
    END IF;
    
    -- Final fallback to original room_types field
    CASE p_field_name
        WHEN 'name' THEN
            SELECT name INTO fallback_text FROM room_types WHERE id = p_room_type_id;
        WHEN 'description' THEN
            SELECT description INTO fallback_text FROM room_types WHERE id = p_room_type_id;
        WHEN 'bed_configuration' THEN
            SELECT bed_configuration INTO fallback_text FROM room_types WHERE id = p_room_type_id;
    END CASE;
    
    RETURN COALESCE(fallback_text, '');
END;
$$ LANGUAGE plpgsql;

-- Create function to upsert translation
CREATE OR REPLACE FUNCTION upsert_room_type_translation(
    p_room_type_id UUID,
    p_field_name VARCHAR,
    p_language_code VARCHAR,
    p_translated_text TEXT,
    p_is_auto_translated BOOLEAN DEFAULT false,
    p_created_by UUID DEFAULT auth.uid()
) RETURNS UUID AS $$
DECLARE
    translation_id UUID;
BEGIN
    INSERT INTO room_type_translations (
        room_type_id,
        field_name,
        language_code,
        translated_text,
        is_auto_translated,
        created_by,
        updated_at
    ) VALUES (
        p_room_type_id,
        p_field_name,
        p_language_code,
        p_translated_text,
        p_is_auto_translated,
        p_created_by,
        NOW()
    )
    ON CONFLICT (room_type_id, field_name, language_code)
    DO UPDATE SET
        translated_text = EXCLUDED.translated_text,
        is_auto_translated = EXCLUDED.is_auto_translated,
        updated_at = NOW(),
        created_by = COALESCE(EXCLUDED.created_by, room_type_translations.created_by)
    RETURNING id INTO translation_id;
    
    RETURN translation_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default English translations from existing room_types data
INSERT INTO room_type_translations (room_type_id, field_name, language_code, translated_text, is_approved)
SELECT 
    id as room_type_id,
    'name' as field_name,
    'en' as language_code,
    name as translated_text,
    true as is_approved
FROM room_types 
WHERE name IS NOT NULL AND name != ''
ON CONFLICT DO NOTHING;

INSERT INTO room_type_translations (room_type_id, field_name, language_code, translated_text, is_approved)
SELECT 
    id as room_type_id,
    'description' as field_name,
    'en' as language_code,
    description as translated_text,
    true as is_approved
FROM room_types 
WHERE description IS NOT NULL AND description != ''
ON CONFLICT DO NOTHING;

INSERT INTO room_type_translations (room_type_id, field_name, language_code, translated_text, is_approved)
SELECT 
    id as room_type_id,
    'bed_configuration' as field_name,
    'en' as language_code,
    bed_configuration as translated_text,
    true as is_approved
FROM room_types 
WHERE bed_configuration IS NOT NULL AND bed_configuration != ''
ON CONFLICT DO NOTHING;

-- Create view for easy translation access
CREATE OR REPLACE VIEW room_type_translations_view AS
SELECT 
    rt.id as room_type_id,
    rt.name as room_type_name,
    p.id as property_id,
    p.name as property_name,
    rtt.field_name,
    rtt.language_code,
    rtt.translated_text,
    rtt.is_auto_translated,
    rtt.is_approved,
    rtt.created_at,
    rtt.updated_at,
    u.email as created_by_email
FROM room_types rt
JOIN properties p ON rt.property_id = p.id
LEFT JOIN room_type_translations rtt ON rt.id = rtt.room_type_id
LEFT JOIN auth.users u ON rtt.created_by = u.id
WHERE rt.is_active = true;

COMMENT ON TABLE room_type_translations IS 'Stores translations for room type text fields in multiple languages';
COMMENT ON FUNCTION get_room_type_translated_text IS 'Helper function to retrieve translated room type text with fallback logic';
COMMENT ON FUNCTION upsert_room_type_translation IS 'Function to insert or update room type translations';
