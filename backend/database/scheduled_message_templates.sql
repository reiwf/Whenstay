-- =============================================
-- Scheduled Message Templates & Automation Rules
-- 8 Schedule Templates as Requested
-- =============================================

-- Insert the 8 message templates
INSERT INTO public.message_templates (name, channel, language, content, variables, property_id) VALUES

-- 1. New Reservation Confirmation (after X minutes of booking)
('New Reservation Confirmation', 'airbnb', 'en', 
'Hi {{guest_name}}! 🎉 Welcome to {{property_name}}! 

Thank you for choosing us for your stay from {{check_in_date}} to {{check_out_date}}. We''re excited to host you and your party of {{num_guests}} guests.

Your booking reference: {{booking_reference}}

We''ll be sending you check-in instructions and important details closer to your arrival date. If you have any questions in the meantime, please don''t hesitate to reach out!

Looking forward to your stay! ✨',
'{"guest_name": "string", "property_name": "string", "check_in_date": "date", "check_out_date": "date", "num_guests": "number", "booking_reference": "string"}', 
NULL),

-- 2. Pre-Check-in Reminder 1 (X days before check-in)
('Pre-Check-in Reminder - 7 Days', 'airbnb', 'en',
'Hi {{guest_name}}! 👋

Just a friendly reminder that your stay at {{property_name}} is coming up in one week! 

📅 Check-in: {{check_in_date}} at {{check_in_time}}
📅 Check-out: {{check_out_date}} at {{check_out_time}}
👥 Guests: {{num_guests}}

We''re preparing everything for your arrival. You''ll receive detailed check-in instructions 24 hours before your arrival.

Is there anything special you''d like us to know about your stay? Any questions about the local area? We''re here to help make your visit memorable!

See you soon! 🏠',
'{"guest_name": "string", "property_name": "string", "check_in_date": "date", "check_out_date": "date", "check_in_time": "time", "check_out_time": "time", "num_guests": "number"}',
NULL),

-- 3. Pre-Check-in Reminder 2 (X days before check-in, skip if checked-in)
('Pre-Check-in Reminder - 3 Days', 'airbnb', 'en',
'Hello {{guest_name}}! 🌟

Your stay at {{property_name}} is just 3 days away! We can''t wait to welcome you.

📍 Address: {{property_address}}
📅 Check-in: {{check_in_date}} at {{check_in_time}}
🛏️ {{num_nights}} nights for {{num_guests}} guests

A few things to prepare for your arrival:
• You''ll receive detailed access instructions 24 hours before check-in
• Early check-in may be available - just ask!
• Local recommendations and WiFi info will be provided upon arrival

Any dietary restrictions or special occasions we should know about? We love helping make stays extra special! 🎉

Excited to host you!',
'{"guest_name": "string", "property_name": "string", "property_address": "string", "check_in_date": "date", "check_in_time": "time", "num_guests": "number", "num_nights": "number"}',
NULL),

-- 4. Pre-Check-in Reminder 3 (X days before check-in, skip if checked-in)
('Final Pre-Check-in Reminder - 1 Day', 'airbnb', 'en',
'Hi {{guest_name}}! 🎯

Tomorrow is the big day - you''re checking in to {{property_name}}!

⏰ Check-in: {{check_in_date}} at {{check_in_time}}
📍 Address: {{property_address}}

Here''s what you need to know:
• Check-in is typically available from {{check_in_time}} onwards
• If you''re arriving earlier, please let us know - we''ll do our best to accommodate
• Look out for our detailed access instructions coming your way soon
• Local area tips and recommendations are in the welcome book

Safe travels, and we''ll see you tomorrow! 🧳✈️

If you have any last-minute questions or your plans change, please don''t hesitate to reach out!',
'{"guest_name": "string", "property_name": "string", "check_in_date": "date", "check_in_time": "time", "property_address": "string"}',
NULL),

-- 5. Check-in Instructions (X hours before check-in time)
('Check-in Instructions', 'airbnb', 'en',
'Welcome to {{property_name}}, {{guest_name}}! 🏡

Your check-in time is today at {{check_in_time}}. Here are your access details:

🔑 **ACCESS INSTRUCTIONS**
{{#if room_number}}Unit: {{room_number}}{{/if}}
[Specific access instructions will be customized per property]

📋 **CHECK-IN DETAILS**
• Address: {{property_address}}
• WiFi Network: [Will be provided]
• WiFi Password: [Will be provided]

🏠 **HOUSE GUIDELINES**
• Quiet hours: 10 PM - 8 AM
• No smoking inside
• Maximum {{num_guests}} guests as booked

📱 **NEED HELP?**
Save this number and message us anytime with questions!

We hope you have a wonderful {{num_nights}}-night stay! 🌟

P.S. Check out the welcome book for local restaurants, attractions, and helpful tips!',
'{"guest_name": "string", "property_name": "string", "check_in_time": "time", "room_number": "string", "property_address": "string", "num_guests": "number", "num_nights": "number"}',
NULL),

-- 6. During Stay Check-in (sent during the stay)
('Mid-Stay Check-in', 'airbnb', 'en',
'Hi {{guest_name}}! 😊

How''s your stay at {{property_name}} going so far? 

We hope you''re settling in well and enjoying the space! Just wanted to check in and make sure you have everything you need for a comfortable stay.

🌟 **How are we doing?**
• Is everything working properly? (WiFi, appliances, etc.)
• Do you need any local recommendations?
• Any questions about the area or amenities?

We''re always here to help make your stay as smooth and enjoyable as possible. If there''s anything at all we can assist with, please don''t hesitate to reach out!

Enjoy the rest of your {{num_nights}}-night stay! 🏡

Thank you for choosing {{property_name}}!',
'{"guest_name": "string", "property_name": "string", "num_nights": "number"}',
NULL),

-- 7. Pre-Check-out Reminder (X hours before check-out)
('Pre-Check-out Reminder', 'airbnb', 'en',
'Hi {{guest_name}}! 👋

Hope you''ve had a wonderful stay at {{property_name}}! 

Just a friendly reminder that check-out is tomorrow at {{check_out_time}}.

📋 **CHECK-OUT INSTRUCTIONS**
• Please be out by {{check_out_time}}
• Leave keys/access cards on the kitchen counter
• Turn off all lights, air conditioning, and appliances
• Take all personal belongings with you
• No need to strip beds or do dishes - we''ve got it covered!

🧳 **LATE CHECK-OUT**
Need a few extra hours? Let us know and we''ll see what we can arrange based on our next guest''s arrival.

Thank you for being such wonderful guests! We hope {{property_name}} felt like home during your {{num_nights}}-night stay.

Safe travels! ✈️🌟',
'{"guest_name": "string", "property_name": "string", "check_out_time": "time", "num_nights": "number"}',
NULL),

-- 8. Post-Stay Follow-up (X days after check-out)
('Post-Stay Follow-up', 'airbnb', 'en',
'Dear {{guest_name}}, 

Thank you so much for staying with us at {{property_name}}! 🌟

We hope your {{num_nights}}-night stay was everything you hoped for and that you made some wonderful memories.

📝 **SHARE YOUR EXPERIENCE**
If you enjoyed your stay, we''d be incredibly grateful if you could leave us a review on {{booking_source}}. Your feedback helps other travelers and helps us continue improving.

🏡 **COME BACK SOON!**
You''re always welcome back! We''d love to host you again for your next trip to the area.

⭐ **SPECIAL OFFER**
As a returning guest, you''ll receive a 10% discount on your next direct booking. Just mention this message when inquiring!

Thank you again for choosing {{property_name}}. It was a pleasure hosting you!

Safe travels and see you next time! ✈️

Warm regards,
The {{property_name}} Team',
'{"guest_name": "string", "property_name": "string", "num_nights": "number", "booking_source": "string"}',
NULL);

-- Create automation rules for each template
-- Note: Template IDs will be generated above, so we need to reference them

-- Get template IDs for automation rules
DO $$
DECLARE
    template_1_id uuid;
    template_2_id uuid;
    template_3_id uuid;
    template_4_id uuid;
    template_5_id uuid;
    template_6_id uuid;
    template_7_id uuid;
    template_8_id uuid;
BEGIN
    -- Get template IDs
    SELECT id INTO template_1_id FROM public.message_templates WHERE name = 'New Reservation Confirmation';
    SELECT id INTO template_2_id FROM public.message_templates WHERE name = 'Pre-Check-in Reminder - 7 Days';
    SELECT id INTO template_3_id FROM public.message_templates WHERE name = 'Pre-Check-in Reminder - 3 Days';
    SELECT id INTO template_4_id FROM public.message_templates WHERE name = 'Final Pre-Check-in Reminder - 1 Day';
    SELECT id INTO template_5_id FROM public.message_templates WHERE name = 'Check-in Instructions';
    SELECT id INTO template_6_id FROM public.message_templates WHERE name = 'Mid-Stay Check-in';
    SELECT id INTO template_7_id FROM public.message_templates WHERE name = 'Pre-Check-out Reminder';
    SELECT id INTO template_8_id FROM public.message_templates WHERE name = 'Post-Stay Follow-up';

    -- Insert automation rules
    
    -- 1. New Reservation Confirmation (5 minutes after booking)
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'New Reservation Confirmation',
        true,
        'relative_to_reservation',
        'booking_created',
        '{"direction": "after", "minutes": 5}',
        template_1_id,
        'airbnb',
        NULL,
        '{"description": "Welcome message sent 5 minutes after booking confirmation"}',
        now()
    );

    -- 2. Pre-Check-in Reminder - 7 Days Before
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'Pre-Check-in Reminder - 7 Days',
        true,
        'relative_to_reservation',
        'check_in',
        '{"direction": "before", "days": 7, "time": "10:00"}',
        template_2_id,
        'airbnb',
        NULL,
        '{"description": "Reminder sent 7 days before check-in at 10 AM"}',
        now()
    );

    -- 3. Pre-Check-in Reminder - 3 Days Before (skip if checked-in)
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'Pre-Check-in Reminder - 3 Days',
        true,
        'relative_to_reservation',
        'check_in',
        '{"direction": "before", "days": 3, "time": "14:00"}',
        template_3_id,
        'airbnb',
        NULL,
        '{"description": "Reminder sent 3 days before check-in at 2 PM", "skip_if_checked_in": true}',
        now()
    );

    -- 4. Final Pre-Check-in Reminder - 1 Day Before (skip if checked-in)
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'Final Pre-Check-in Reminder - 1 Day',
        true,
        'relative_to_reservation',
        'check_in',
        '{"direction": "before", "days": 1, "time": "18:00"}',
        template_4_id,
        'airbnb',
        NULL,
        '{"description": "Final reminder sent 1 day before check-in at 6 PM", "skip_if_checked_in": true}',
        now()
    );

    -- 5. Check-in Instructions (3 hours before check-in)
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'Check-in Instructions',
        true,
        'relative_to_reservation',
        'check_in',
        '{"direction": "before", "hours": 3}',
        template_5_id,
        'airbnb',
        NULL,
        '{"description": "Access instructions sent 3 hours before check-in time"}',
        now()
    );

    -- 6. Mid-Stay Check-in (1 day after check-in, during stay)
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'Mid-Stay Check-in',
        true,
        'relative_to_reservation',
        'check_in',
        '{"direction": "after", "days": 1, "time": "16:00"}',
        template_6_id,
        'airbnb',
        '{"min_nights": 2}',
        '{"description": "Check-in message sent 1 day after check-in at 4 PM for stays 2+ nights"}',
        now()
    );

    -- 7. Pre-Check-out Reminder (12 hours before check-out)
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'Pre-Check-out Reminder',
        true,
        'relative_to_reservation',
        'check_out',
        '{"direction": "before", "hours": 12}',
        template_7_id,
        'airbnb',
        NULL,
        '{"description": "Check-out reminder sent 12 hours before check-out time"}',
        now()
    );

    -- 8. Post-Stay Follow-up (2 days after check-out)
    INSERT INTO public.automation_rules (
        name, enabled, trigger_type, event, offset_json, template_id, channel, 
        filters, options, created_at
    ) VALUES (
        'Post-Stay Follow-up',
        true,
        'relative_to_reservation',
        'check_out',
        '{"direction": "after", "days": 2, "time": "11:00"}',
        template_8_id,
        'airbnb',
        NULL,
        '{"description": "Follow-up and review request sent 2 days after check-out at 11 AM"}',
        now()
    );

END $$;

-- Display summary of what was created
SELECT 
    'Templates Created' as type,
    count(*) as count
FROM public.message_templates 
WHERE name IN (
    'New Reservation Confirmation',
    'Pre-Check-in Reminder - 7 Days', 
    'Pre-Check-in Reminder - 3 Days',
    'Final Pre-Check-in Reminder - 1 Day',
    'Check-in Instructions',
    'Mid-Stay Check-in',
    'Pre-Check-out Reminder', 
    'Post-Stay Follow-up'
)

UNION ALL

SELECT 
    'Automation Rules Created' as type,
    count(*) as count
FROM public.automation_rules 
WHERE name IN (
    'New Reservation Confirmation',
    'Pre-Check-in Reminder - 7 Days',
    'Pre-Check-in Reminder - 3 Days', 
    'Final Pre-Check-in Reminder - 1 Day',
    'Check-in Instructions',
    'Mid-Stay Check-in',
    'Pre-Check-out Reminder',
    'Post-Stay Follow-up'
);
