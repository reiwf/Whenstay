-- Migration script from Schema V1 to Schema V2
-- This script helps migrate existing data to the new structure
-- Run this AFTER running schema_v2.sql

-- Step 1: Create temporary mapping table for user migration
CREATE TEMP TABLE user_migration_mapping (
    old_user_id UUID,
    new_auth_id UUID,
    email VARCHAR(255),
    role user_role
);

-- Step 2: If you have existing users in the old 'users' table, 
-- you'll need to create corresponding Supabase Auth users first
-- This is a manual process that should be done through Supabase Auth API

-- For now, we'll create a placeholder function to help with the migration
CREATE OR REPLACE FUNCTION migrate_user_to_auth(
    user_email VARCHAR(255),
    user_password VARCHAR(255),
    user_role user_role,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50)
)
RETURNS UUID AS $$
DECLARE
    new_auth_id UUID;
BEGIN
    -- This function should be called after creating the user in Supabase Auth
    -- The new_auth_id should be the ID returned from Supabase Auth
    
    -- For demo purposes, we'll generate a UUID
    -- In real migration, this would be the actual auth.users.id
    new_auth_id := uuid_generate_v4();
    
    -- Insert into user_profiles
    INSERT INTO user_profiles (id, role, first_name, last_name, phone)
    VALUES (new_auth_id, user_role, first_name, last_name, phone);
    
    RETURN new_auth_id;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Migrate apartments to properties and rooms
-- This assumes you have existing data in the 'apartments' table

-- Create a function to migrate apartment data
CREATE OR REPLACE FUNCTION migrate_apartments_to_properties_and_rooms()
RETURNS VOID AS $$
DECLARE
    apt_record RECORD;
    new_property_id UUID;
    new_room_id UUID;
BEGIN
    -- Loop through existing apartments
    FOR apt_record IN SELECT * FROM apartments LOOP
        -- Create property
        INSERT INTO properties (
            name,
            address,
            owner_id,
            total_rooms,
            wifi_name,
            wifi_password,
            house_rules,
            check_in_instructions,
            created_at,
            updated_at
        ) VALUES (
            apt_record.name,
            apt_record.address,
            apt_record.owner_id, -- This should be updated to reference user_profiles
            1, -- Assuming each apartment becomes a single room
            apt_record.wifi_name,
            apt_record.wifi_password,
            apt_record.house_rules,
            apt_record.check_in_instructions,
            apt_record.created_at,
            apt_record.updated_at
        ) RETURNING id INTO new_property_id;
        
        -- Create room for this property
        INSERT INTO rooms (
            property_id,
            room_number,
            room_name,
            max_guests,
            access_code,
            room_amenities,
            created_at,
            updated_at
        ) VALUES (
            new_property_id,
            COALESCE(apt_record.room_number, '101'),
            apt_record.name,
            apt_record.max_guests,
            apt_record.access_code,
            apt_record.amenities,
            apt_record.created_at,
            apt_record.updated_at
        ) RETURNING id INTO new_room_id;
        
        -- Update reservations to reference the new room
        UPDATE reservations 
        SET room_id = new_room_id 
        WHERE room_number = apt_record.room_number;
        
        -- Update cleaning tasks to reference property and room
        UPDATE cleaning_tasks 
        SET property_id = new_property_id, room_id = new_room_id 
        WHERE apartment_id = apt_record.id;
        
        -- Update guest app content
        UPDATE guest_app_content 
        SET property_id = new_property_id 
        WHERE apartment_id = apt_record.id;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Clean up old tables (run this AFTER confirming migration is successful)
CREATE OR REPLACE FUNCTION cleanup_old_schema()
RETURNS VOID AS $$
BEGIN
    -- Drop old tables
    DROP TABLE IF EXISTS apartments CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    
    -- Drop old columns from reservations
    ALTER TABLE reservations DROP COLUMN IF EXISTS room_number;
    
    -- Drop old columns from cleaning_tasks
    ALTER TABLE cleaning_tasks DROP COLUMN IF EXISTS apartment_id;
    
    -- Drop old columns from guest_app_content
    ALTER TABLE guest_app_content DROP COLUMN IF EXISTS apartment_id;
    
    RAISE NOTICE 'Old schema cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update test data for the new schema
-- This replaces the old test data with new structure

-- Clear existing test data if any
DELETE FROM guest_checkins;
DELETE FROM cleaning_tasks;
DELETE FROM reservations;
DELETE FROM rooms;
DELETE FROM properties;
DELETE FROM user_profiles;

-- Insert test user profiles (these should match Supabase Auth users)
INSERT INTO user_profiles (id, role, first_name, last_name, phone) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin', 'Admin', 'User', '+1234567890'),
('550e8400-e29b-41d4-a716-446655440001', 'owner', 'John', 'Smith', '+1234567891'),
('550e8400-e29b-41d4-a716-446655440002', 'cleaner', 'Maria', 'Garcia', '+1234567892')
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone;

-- Insert test property
INSERT INTO properties (id, name, address, owner_id, total_rooms, wifi_name, wifi_password, house_rules, check_in_instructions) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'Sunset Beach Resort', '123 Ocean Drive, Miami Beach, FL 33139', '550e8400-e29b-41d4-a716-446655440001', 22, 'SunsetBeach_WiFi', 'beach2024!', 'No smoking, No pets, Quiet hours 10PM-8AM', 'Check-in is at the front desk. Use your room access code for entry.')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    owner_id = EXCLUDED.owner_id,
    total_rooms = EXCLUDED.total_rooms,
    wifi_name = EXCLUDED.wifi_name,
    wifi_password = EXCLUDED.wifi_password,
    house_rules = EXCLUDED.house_rules,
    check_in_instructions = EXCLUDED.check_in_instructions;

-- Insert test rooms
INSERT INTO rooms (property_id, room_number, room_name, max_guests, access_code, room_amenities, bed_configuration) VALUES
('660e8400-e29b-41d4-a716-446655440000', '101', 'Ocean View Suite', 4, '1234', '{"tv": true, "minibar": true, "balcony": true, "ocean_view": true}', '1 King Bed + Sofa Bed'),
('660e8400-e29b-41d4-a716-446655440000', '102', 'Standard Room', 2, '5678', '{"tv": true, "minibar": false, "balcony": false, "ocean_view": false}', '1 Queen Bed'),
('660e8400-e29b-41d4-a716-446655440000', '201', 'Deluxe Suite', 6, '9012', '{"tv": true, "minibar": true, "balcony": true, "ocean_view": true, "kitchen": true}', '2 Queen Beds + Sofa Bed')
ON CONFLICT (property_id, room_number) DO UPDATE SET
    room_name = EXCLUDED.room_name,
    max_guests = EXCLUDED.max_guests,
    access_code = EXCLUDED.access_code,
    room_amenities = EXCLUDED.room_amenities,
    bed_configuration = EXCLUDED.bed_configuration;

-- Insert test reservations
INSERT INTO reservations (beds24_booking_id, room_id, guest_name, guest_email, check_in_date, check_out_date, num_guests, total_amount, status) VALUES
('BK001', (SELECT id FROM rooms WHERE room_number = '101'), 'John Smith', 'john.smith@example.com', '2025-01-28', '2025-01-30', 2, 299.99, 'invited'),
('BK002', (SELECT id FROM rooms WHERE room_number = '102'), 'Sarah Johnson', 'sarah.johnson@example.com', '2025-01-29', '2025-02-01', 1, 199.99, 'invited'),
('BK003', (SELECT id FROM rooms WHERE room_number = '201'), 'Michael Brown', 'michael.brown@example.com', '2025-01-30', '2025-02-03', 4, 399.99, 'invited')
ON CONFLICT (beds24_booking_id) DO UPDATE SET
    room_id = EXCLUDED.room_id,
    guest_name = EXCLUDED.guest_name,
    guest_email = EXCLUDED.guest_email,
    check_in_date = EXCLUDED.check_in_date,
    check_out_date = EXCLUDED.check_out_date,
    num_guests = EXCLUDED.num_guests,
    total_amount = EXCLUDED.total_amount,
    status = EXCLUDED.status;

-- Add some guest app content for testing
INSERT INTO guest_app_content (property_id, content_type, title, content, display_order) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'wifi', 'WiFi Information', 'Network: SunsetBeach_WiFi\nPassword: beach2024!', 1),
('660e8400-e29b-41d4-a716-446655440000', 'amenities', 'Property Amenities', 'Pool, Gym, Beach Access, Parking', 2),
('660e8400-e29b-41d4-a716-446655440000', 'local_info', 'Local Information', 'Beach: 2 min walk\nRestaurants: 5 min walk\nSupermarket: 10 min walk', 3),
('660e8400-e29b-41d4-a716-446655440000', 'emergency', 'Emergency Contacts', 'Property Manager: +1-555-0123\nLocal Emergency: 911', 4);

-- Add room-specific content
INSERT INTO guest_app_content (property_id, room_id, content_type, title, content, display_order) VALUES
('660e8400-e29b-41d4-a716-446655440000', (SELECT id FROM rooms WHERE room_number = '101'), 'room_guide', 'Room 101 Guide', 'Ocean view balcony access. Minibar stocked daily. TV remote on nightstand.', 1),
('660e8400-e29b-41d4-a716-446655440000', (SELECT id FROM rooms WHERE room_number = '201'), 'room_guide', 'Room 201 Guide', 'Full kitchen available. Balcony with ocean view. Extra towels in bathroom closet.', 1);

COMMENT ON FUNCTION migrate_user_to_auth IS 'Helper function for migrating users to Supabase Auth';
COMMENT ON FUNCTION migrate_apartments_to_properties_and_rooms IS 'Migrates old apartment structure to new property/room structure';
COMMENT ON FUNCTION cleanup_old_schema IS 'Removes old tables after successful migration';
