-- ================================================
-- Setup Real-time Inbox Updates
-- Run this in Supabase SQL Editor
-- ================================================

-- Step 1: Enable realtime for message_threads table
ALTER PUBLICATION supabase_realtime ADD TABLE message_threads;

-- Step 2: Create function to update thread metadata when messages change
CREATE OR REPLACE FUNCTION update_thread_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the thread with latest message info
    UPDATE message_threads 
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 160),
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    
    -- Return the new record
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create triggers
-- Trigger for INSERT operations on messages
DROP TRIGGER IF EXISTS trg_update_thread_on_message_insert ON messages;
CREATE TRIGGER trg_update_thread_on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_metadata();

-- Trigger for UPDATE operations on messages (in case message content is updated)
DROP TRIGGER IF EXISTS trg_update_thread_on_message_update ON messages;
CREATE TRIGGER trg_update_thread_on_message_update
    AFTER UPDATE ON messages
    FOR EACH ROW
    WHEN (OLD.content IS DISTINCT FROM NEW.content OR OLD.created_at IS DISTINCT FROM NEW.created_at)
    EXECUTE FUNCTION update_thread_metadata();

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_thread_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION update_thread_metadata() TO anon;

-- Verify setup
SELECT 
    'Realtime enabled for message_threads' as status,
    EXISTS(
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'message_threads'
    ) as enabled;

SELECT 
    'Triggers created' as status,
    COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE trigger_name LIKE 'trg_update_thread_on_message%';

-- Done! Your inbox will now update in real-time when new messages arrive.
