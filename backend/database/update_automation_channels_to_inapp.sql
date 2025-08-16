-- Update all automation rules to use inapp channel instead of external channels
-- This ensures all scheduled messages are delivered through the in-app communication system

UPDATE automation_rules 
SET channel = 'inapp' 
WHERE channel != 'inapp';

-- Verify the update
SELECT name, channel 
FROM automation_rules 
ORDER BY created_at;
