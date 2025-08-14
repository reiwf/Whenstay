-- ================================================
-- Fix Message Deliveries RLS Policy
-- This fixes the issue where guests can't see delivery status updates
-- ================================================

-- Add missing RLS policy for message_deliveries table
CREATE POLICY message_deliveries_policy ON public.message_deliveries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.message_threads mt ON m.thread_id = mt.id
            JOIN public.reservations r ON mt.reservation_id = r.id
            JOIN public.properties p ON r.property_id = p.id
            WHERE m.id = message_deliveries.message_id
            AND (
                p.owner_id = auth.uid() 
                OR auth.uid() IN (
                    SELECT id FROM public.user_profiles WHERE role = 'admin'
                )
                OR auth.uid() IS NULL  -- Allow anonymous access for guests
            )
        )
    );

-- Enable realtime for message_deliveries table
ALTER PUBLICATION supabase_realtime ADD TABLE message_deliveries;

-- Also add the missing policies for message_attachments
CREATE POLICY message_attachments_policy ON public.message_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.message_threads mt ON m.thread_id = mt.id
            JOIN public.reservations r ON mt.reservation_id = r.id
            JOIN public.properties p ON r.property_id = p.id
            WHERE m.id = message_attachments.message_id
            AND (
                p.owner_id = auth.uid() 
                OR auth.uid() IN (
                    SELECT id FROM public.user_profiles WHERE role = 'admin'
                )
                OR auth.uid() IS NULL  -- Allow anonymous access for guests
            )
        )
    );

-- Add policies for scheduled_messages
CREATE POLICY scheduled_messages_policy ON public.scheduled_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.message_threads mt
            JOIN public.reservations r ON mt.reservation_id = r.id
            JOIN public.properties p ON r.property_id = p.id
            WHERE mt.id = scheduled_messages.thread_id
            AND (
                p.owner_id = auth.uid() 
                OR auth.uid() IN (
                    SELECT id FROM public.user_profiles WHERE role = 'admin'
                )
            )
        )
    );

-- Add policies for automation_rules
CREATE POLICY automation_rules_policy ON public.automation_rules
    FOR ALL USING (
        property_id IS NULL OR EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = automation_rules.property_id
            AND (
                p.owner_id = auth.uid() 
                OR auth.uid() IN (
                    SELECT id FROM public.user_profiles WHERE role = 'admin'
                )
            )
        )
    );

-- Add policies for guest_channel_consents
CREATE POLICY guest_channel_consents_policy ON public.guest_channel_consents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.reservations r
            JOIN public.properties p ON r.property_id = p.id
            WHERE r.id = guest_channel_consents.reservation_id
            AND (
                p.owner_id = auth.uid() 
                OR auth.uid() IN (
                    SELECT id FROM public.user_profiles WHERE role = 'admin'
                )
                OR auth.uid() IS NULL  -- Allow anonymous access for guests
            )
        )
    );

-- Add policies for thread_labels
CREATE POLICY thread_labels_policy ON public.thread_labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.message_threads mt
            JOIN public.reservations r ON mt.reservation_id = r.id
            JOIN public.properties p ON r.property_id = p.id
            WHERE mt.id = thread_labels.thread_id
            AND (
                p.owner_id = auth.uid() 
                OR auth.uid() IN (
                    SELECT id FROM public.user_profiles WHERE role = 'admin'
                )
            )
        )
    );

-- Verify the policies are created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles
FROM pg_policies 
WHERE tablename IN ('message_deliveries', 'message_attachments', 'scheduled_messages', 'automation_rules', 'guest_channel_consents', 'thread_labels')
ORDER BY tablename, policyname;

-- Check realtime publications
SELECT 
    pubname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('message_deliveries', 'messages', 'message_threads')
ORDER BY tablename;
