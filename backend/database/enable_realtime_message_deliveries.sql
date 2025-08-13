-- ================================================
-- Enable Real-time for Message Deliveries
-- Run this in Supabase SQL Editor to enable delivery status updates
-- ================================================

-- Step 1: Enable realtime for message_deliveries table
ALTER PUBLICATION supabase_realtime ADD TABLE message_deliveries;

-- Step 2: Enable realtime for messages table (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 3: Grant necessary permissions for real-time subscriptions
GRANT SELECT ON message_deliveries TO authenticated;
GRANT SELECT ON message_deliveries TO anon;

-- Step 4: Verify setup
SELECT 
    'Realtime enabled for message_deliveries' as status,
    EXISTS(
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'message_deliveries'
    ) as enabled;

SELECT 
    'Realtime enabled for messages' as status,
    EXISTS(
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) as enabled;

-- List all tables enabled for real-time
SELECT 
    'Currently enabled real-time tables:' as info,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Done! Delivery status updates will now be sent in real-time
