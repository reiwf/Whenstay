-- Email Metadata Table Migration
-- This migration moves email threading columns from messages table to a dedicated email_metadata table
-- It also consolidates inconsistent data storage from message_deliveries table

-- ===============================================
-- STEP 1: CREATE EMAIL_METADATA TABLE
-- ===============================================

CREATE TABLE IF NOT EXISTS email_metadata (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL UNIQUE,
    email_message_id TEXT,
    email_thread_id TEXT, 
    email_in_reply_to TEXT,
    email_references TEXT,
    email_name TEXT,
    email_provider_data JSONB,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Add helpful comments
COMMENT ON TABLE email_metadata IS 'Dedicated table for email threading metadata, separated from messages for better performance';
COMMENT ON COLUMN email_metadata.email_message_id IS 'Gmail Message-ID header for threading';
COMMENT ON COLUMN email_metadata.email_thread_id IS 'Gmail thread ID for conversation grouping';
COMMENT ON COLUMN email_metadata.email_in_reply_to IS 'Gmail In-Reply-To header for reply threading';
COMMENT ON COLUMN email_metadata.email_references IS 'Gmail References header chain';
COMMENT ON COLUMN email_metadata.email_name IS 'Sender display name from email From header (e.g., "John Doe")';
COMMENT ON COLUMN email_metadata.email_provider_data IS 'Provider-specific data (n8n response, delivery info, etc.)';

-- ===============================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_email_metadata_message_id ON email_metadata(message_id);
CREATE INDEX IF NOT EXISTS idx_email_metadata_email_message_id ON email_metadata(email_message_id);
CREATE INDEX IF NOT EXISTS idx_email_metadata_email_thread_id ON email_metadata(email_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_metadata_email_in_reply_to ON email_metadata(email_in_reply_to);
CREATE INDEX IF NOT EXISTS idx_email_metadata_email_name ON email_metadata(email_name);
CREATE INDEX IF NOT EXISTS idx_email_metadata_created_at ON email_metadata(created_at);

-- ===============================================
-- STEP 3: MIGRATE EXISTING DATA (IF COLUMNS EXIST)
-- ===============================================

-- First, check and migrate data from messages table if email threading columns exist
DO $$
BEGIN
  -- Check if email threading columns exist in messages table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'email_message_id'
  ) THEN
    RAISE NOTICE 'Migrating email threading data from messages table...';
    
    INSERT INTO email_metadata (
        message_id,
        email_message_id,
        email_thread_id,
        email_in_reply_to,
        email_references,
        email_provider_data,
        created_at,
        updated_at
    )
    SELECT 
        m.id as message_id,
        m.email_message_id,
        m.email_thread_id,
        m.email_in_reply_to,
        m.email_references,
        m.email_provider_data,
        m.created_at,
        m.updated_at
    FROM messages m
    WHERE m.channel = 'email' 
      AND (
        m.email_message_id IS NOT NULL OR 
        m.email_thread_id IS NOT NULL OR 
        m.email_in_reply_to IS NOT NULL OR 
        m.email_references IS NOT NULL OR 
        m.email_provider_data IS NOT NULL
      )
    ON CONFLICT (message_id) DO UPDATE SET
        email_message_id = EXCLUDED.email_message_id,
        email_thread_id = EXCLUDED.email_thread_id,
        email_in_reply_to = EXCLUDED.email_in_reply_to,
        email_references = EXCLUDED.email_references,
        email_provider_data = EXCLUDED.email_provider_data,
        updated_at = now();
        
    RAISE NOTICE 'Migration from messages table completed.';
  ELSE
    RAISE NOTICE 'No email threading columns found in messages table, skipping migration.';
  END IF;
END $$;

-- Then check and migrate data from message_deliveries table if email threading columns exist
DO $$
BEGIN
  -- Check if email threading columns exist in message_deliveries table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'message_deliveries' 
    AND column_name = 'email_message_id'
  ) THEN
    RAISE NOTICE 'Migrating email threading data from message_deliveries table...';
    
    INSERT INTO email_metadata (
        message_id,
        email_message_id,
        email_thread_id,
        email_in_reply_to,
        email_references,
        email_provider_data,
        created_at,
        updated_at
    )
    SELECT 
        md.message_id,
        md.email_message_id,
        md.email_thread_id,
        md.email_in_reply_to,
        md.email_references,
        md.email_provider_data,
        md.created_at,
        md.updated_at
    FROM message_deliveries md
    WHERE md.channel = 'email'
      AND (
        md.email_message_id IS NOT NULL OR 
        md.email_thread_id IS NOT NULL OR 
        md.email_in_reply_to IS NOT NULL OR 
        md.email_references IS NOT NULL OR 
        md.email_provider_data IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_metadata em WHERE em.message_id = md.message_id
      )
    ON CONFLICT (message_id) DO UPDATE SET
        -- Merge data, preferring non-null values
        email_message_id = COALESCE(EXCLUDED.email_message_id, email_metadata.email_message_id),
        email_thread_id = COALESCE(EXCLUDED.email_thread_id, email_metadata.email_thread_id),
        email_in_reply_to = COALESCE(EXCLUDED.email_in_reply_to, email_metadata.email_in_reply_to),
        email_references = COALESCE(EXCLUDED.email_references, email_metadata.email_references),
        email_provider_data = COALESCE(EXCLUDED.email_provider_data, email_metadata.email_provider_data),
        updated_at = now();
        
    RAISE NOTICE 'Migration from message_deliveries table completed.';
  ELSE
    RAISE NOTICE 'No email threading columns found in message_deliveries table, skipping migration.';
  END IF;
END $$;

-- ===============================================
-- STEP 4: UPDATE FUNCTIONS TO USE NEW TABLE
-- ===============================================

-- Update function to extract threading info (keep same signature for compatibility)
CREATE OR REPLACE FUNCTION extract_email_threading_info(webhook_data JSONB)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'messageId', COALESCE(webhook_data->>'messageId', webhook_data->'message-id'->>'value'),
    'inReplyTo', COALESCE(webhook_data->>'inReplyTo', webhook_data->'in-reply-to'->>'value'),
    'references', COALESCE(webhook_data->>'references', webhook_data->'references'->>'value'),
    'threadId', webhook_data->>'threadId',
    'subject', webhook_data->>'subject'
  );
END;
$$ LANGUAGE plpgsql;

-- Update function to find existing thread by Gmail data (using new table)
CREATE OR REPLACE FUNCTION find_thread_by_email_data(
  email_message_id TEXT DEFAULT NULL,
  email_in_reply_to TEXT DEFAULT NULL,
  email_thread_id TEXT DEFAULT NULL,
  sender_email TEXT DEFAULT NULL
)
RETURNS TABLE(thread_id UUID, match_method TEXT, confidence TEXT) AS $$
BEGIN
  -- Priority 1: Match by In-Reply-To (highest confidence)
  IF email_in_reply_to IS NOT NULL THEN
    RETURN QUERY
    SELECT mt.id, 'in_reply_to'::TEXT, 'high'::TEXT
    FROM message_threads mt
    INNER JOIN messages m ON m.thread_id = mt.id
    INNER JOIN email_metadata em ON em.message_id = m.id
    WHERE em.email_message_id = email_in_reply_to
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 2: Match by Gmail Thread ID (high confidence)
  IF email_thread_id IS NOT NULL THEN
    RETURN QUERY
    SELECT mt.id, 'email_thread_id'::TEXT, 'high'::TEXT
    FROM message_threads mt
    INNER JOIN messages m ON m.thread_id = mt.id
    INNER JOIN email_metadata em ON em.message_id = m.id
    WHERE em.email_thread_id = email_thread_id
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 3: Match by sender email to recent active thread (medium confidence)
  IF sender_email IS NOT NULL THEN
    RETURN QUERY
    SELECT mt.id, 'sender_email'::TEXT, 'medium'::TEXT
    FROM message_threads mt
    INNER JOIN reservations r ON r.id = mt.reservation_id
    WHERE (r.guest_email = sender_email OR r.booking_email = sender_email)
      AND mt.status IN ('open', 'closed')
      AND r.check_out_date >= (CURRENT_DATE - INTERVAL '30 days')
    ORDER BY mt.last_message_at DESC NULLS LAST
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- No match found
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Update function to store email threading data (using new table)
CREATE OR REPLACE FUNCTION store_email_threading_data(
  message_id UUID,
  email_msg_id TEXT,
  email_thread_id TEXT,
  email_in_reply_to TEXT,
  email_references TEXT,
  provider_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO email_metadata (
    message_id,
    email_message_id,
    email_thread_id,
    email_in_reply_to,
    email_references,
    email_provider_data,
    updated_at
  ) VALUES (
    message_id,
    email_msg_id,
    email_thread_id,
    email_in_reply_to,
    email_references,
    provider_data,
    NOW()
  )
  ON CONFLICT (message_id) DO UPDATE SET
    email_message_id = EXCLUDED.email_message_id,
    email_thread_id = EXCLUDED.email_thread_id,
    email_in_reply_to = EXCLUDED.email_in_reply_to,
    email_references = EXCLUDED.email_references,
    email_provider_data = COALESCE(EXCLUDED.email_provider_data, email_metadata.email_provider_data),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- STEP 5: UPDATE EMAIL THREADING DEBUG VIEW
-- ===============================================

-- Drop the existing view to handle data type changes
DROP VIEW IF EXISTS email_threading_debug;

-- Recreate the view with new email_metadata table structure
CREATE VIEW email_threading_debug AS
SELECT 
  m.id as message_id,
  m.thread_id,
  mt.subject as thread_subject,
  m.content as message_preview,
  em.email_message_id,
  em.email_thread_id,
  em.email_in_reply_to,
  em.email_references,
  em.email_name,
  em.email_provider_data,
  m.origin_role,
  m.direction,
  m.channel,
  m.created_at as message_created_at,
  r.id as reservation_id,
  r.booking_name,
  r.booking_email
FROM messages m
LEFT JOIN email_metadata em ON em.message_id = m.id
LEFT JOIN message_threads mt ON mt.id = m.thread_id
LEFT JOIN reservations r ON r.id = mt.reservation_id
WHERE m.channel = 'email'
ORDER BY m.created_at DESC;

COMMENT ON VIEW email_threading_debug IS 'Debug view for Gmail email threading analysis using email_metadata table';

-- ===============================================
-- STEP 6: ADD TRIGGER FOR AUTOMATIC TIMESTAMP UPDATES
-- ===============================================

CREATE OR REPLACE FUNCTION update_email_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_metadata_updated_at
    BEFORE UPDATE ON email_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_email_metadata_updated_at();

-- ===============================================
-- STEP 7: HELPER FUNCTIONS FOR DATA ACCESS
-- ===============================================

-- Function to get email metadata for a message
CREATE OR REPLACE FUNCTION get_email_metadata(p_message_id UUID)
RETURNS TABLE(
  email_message_id TEXT,
  email_thread_id TEXT,
  email_in_reply_to TEXT,
  email_references TEXT,
  email_name TEXT,
  email_provider_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.email_message_id,
    em.email_thread_id,
    em.email_in_reply_to,
    em.email_references,
    em.email_name,
    em.email_provider_data
  FROM email_metadata em
  WHERE em.message_id = p_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest Gmail threading context for a thread
CREATE OR REPLACE FUNCTION get_thread_gmail_context(p_thread_id UUID)
RETURNS TABLE(
  latest_gmail_message_id TEXT,
  gmail_thread_id TEXT,
  in_reply_to TEXT,
  email_references TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    em.email_message_id,
    em.email_thread_id,
    em.email_in_reply_to,
    em.email_references
  FROM messages m
  INNER JOIN email_metadata em ON em.message_id = m.id
  WHERE m.thread_id = p_thread_id
    AND m.channel = 'email'
    AND em.email_message_id IS NOT NULL
  ORDER BY m.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- STEP 8: CLEAN UP AFTER SUCCESSFUL MIGRATION
-- ===============================================

-- Note: Column removal will be done in a separate step after code is updated
-- ALTER TABLE messages DROP COLUMN IF EXISTS email_message_id;
-- ALTER TABLE messages DROP COLUMN IF EXISTS email_thread_id;
-- ALTER TABLE messages DROP COLUMN IF EXISTS email_in_reply_to;
-- ALTER TABLE messages DROP COLUMN IF EXISTS email_references;
-- ALTER TABLE messages DROP COLUMN IF EXISTS email_provider_data;

-- Clean up email metadata from message_deliveries table after migration
-- UPDATE message_deliveries SET 
--   email_message_id = NULL,
--   email_thread_id = NULL,
--   email_in_reply_to = NULL,
--   email_references = NULL,
--   email_provider_data = NULL
-- WHERE channel = 'email';

-- ===============================================
-- STEP 9: MIGRATION COMPLETION LOG
-- ===============================================

INSERT INTO webhook_events (event_type, payload, processed, created_at) 
VALUES (
  'database_migration',
  jsonb_build_object(
    'migration', 'email-metadata-table-migration',
    'version', '2.0.0',
    'description', 'Moved email threading data to dedicated email_metadata table',
    'migrated_tables', jsonb_build_array('messages', 'message_deliveries'),
    'new_table', 'email_metadata',
    'functions_updated', jsonb_build_array(
      'extract_email_threading_info',
      'find_thread_by_email_data', 
      'store_email_threading_data',
      'get_email_metadata',
      'get_thread_gmail_context'
    ),
    'views_updated', jsonb_build_array('email_threading_debug')
  ),
  true,
  NOW()
) ON CONFLICT DO NOTHING;

-- Display migration summary
DO $$
DECLARE
  migrated_count INTEGER;
  total_email_messages INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM email_metadata;
  SELECT COUNT(*) INTO total_email_messages FROM messages WHERE channel = 'email';
  
  RAISE NOTICE 'Email Metadata Migration Complete!';
  RAISE NOTICE 'Total email messages: %', total_email_messages;
  RAISE NOTICE 'Messages with email metadata: %', migrated_count;
  RAISE NOTICE 'Migration efficiency: %.1f%% (only messages with actual email data were migrated)', 
    CASE WHEN total_email_messages > 0 THEN (migrated_count::numeric / total_email_messages::numeric) * 100 ELSE 0 END;
END $$;
