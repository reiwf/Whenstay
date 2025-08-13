-- Function to update thread metadata when messages are inserted or updated
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

-- Create trigger for INSERT operations on messages
DROP TRIGGER IF EXISTS trg_update_thread_on_message_insert ON messages;
CREATE TRIGGER trg_update_thread_on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_metadata();

-- Create trigger for UPDATE operations on messages (in case message content is updated)
DROP TRIGGER IF EXISTS trg_update_thread_on_message_update ON messages;
CREATE TRIGGER trg_update_thread_on_message_update
    AFTER UPDATE ON messages
    FOR EACH ROW
    WHEN (OLD.content IS DISTINCT FROM NEW.content OR OLD.created_at IS DISTINCT FROM NEW.created_at)
    EXECUTE FUNCTION update_thread_metadata();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_thread_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION update_thread_metadata() TO anon;
