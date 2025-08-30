-- Email threading support for inbound email integration
-- Add email threading columns to existing message_threads table

ALTER TABLE message_threads 
ADD COLUMN IF NOT EXISTS email_thread_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS needs_linking BOOLEAN DEFAULT FALSE;

-- Add email message tracking columns to existing messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS email_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_references TEXT[];

-- Create indexes for efficient email threading queries
CREATE INDEX IF NOT EXISTS idx_threads_email_thread_id ON message_threads(email_thread_id) WHERE email_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_needs_linking ON message_threads(needs_linking) WHERE needs_linking = true;
CREATE INDEX IF NOT EXISTS idx_messages_email_message_id ON messages(email_message_id) WHERE email_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_in_reply_to ON messages(in_reply_to) WHERE in_reply_to IS NOT NULL;

-- Create table for tracking processed Gmail messages to avoid duplicates
CREATE TABLE IF NOT EXISTS gmail_processed_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gmail_message_id VARCHAR(255) UNIQUE NOT NULL,
    thread_id UUID REFERENCES message_threads(id),
    message_id UUID REFERENCES messages(id),
    processed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmail_processed_message_id ON gmail_processed_messages(gmail_message_id);

-- Create table for email matching confidence tracking
CREATE TABLE IF NOT EXISTS email_thread_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES message_threads(id),
    gmail_message_id VARCHAR(255) NOT NULL,
    match_method VARCHAR(50) NOT NULL, -- 'email_headers', 'guest_email', 'manual_link'
    confidence_level VARCHAR(20) NOT NULL, -- 'high', 'medium', 'low'
    match_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_matches_thread_id ON email_thread_matches(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_matches_confidence ON email_thread_matches(confidence_level);

-- Add comments for documentation
COMMENT ON COLUMN message_threads.email_thread_id IS 'Email thread ID for grouping related email messages';
COMMENT ON COLUMN message_threads.needs_linking IS 'Flag for threads that need manual linking to reservations';
COMMENT ON COLUMN messages.email_message_id IS 'Gmail message ID for email-originated messages';
COMMENT ON COLUMN messages.in_reply_to IS 'Email In-Reply-To header for threading';
COMMENT ON COLUMN messages.email_references IS 'Email References header chain for threading';
