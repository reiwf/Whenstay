-- Whenstay Check-in App Database Schema V2
-- Updated with Supabase Auth integration and Property/Room structure
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE reservation_status AS ENUM ('pending', 'invited', 'completed', 'cancelled');
CREATE TYPE user_role AS ENUM ('admin', 'owner', 'guest', 'cleaner');
CREATE TYPE cleaning_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- User profiles table (references Supabase auth.users)
-- This replaces the custom users table and integrates with Supabase Auth
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    company_name VARCHAR(255), -- For property owners
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Properties table (replaces apartments table)
-- Represents the main property/building
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL, -- "Property Label 01", "Sunset Beach Resort"
    address TEXT NOT NULL,
    owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    description TEXT,
    property_type VARCHAR(100) DEFAULT 'apartment', -- apartment, hotel, villa, etc.
    total_rooms INTEGER DEFAULT 1,
    wifi_name VARCHAR(255),
    wifi_password VARCHAR(255),
    house_rules TEXT,
    check_in_instructions TEXT,
    emergency_contact VARCHAR(255),
    property_amenities JSONB, -- Pool, gym, parking, etc.
    location_info JSONB, -- Nearby attractions, transport, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table (individual rooms within properties)
-- Each room within a property
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL, -- "101", "102", "A1", "Suite-1"
    room_name VARCHAR(255), -- "Deluxe Suite", "Standard Room", "Ocean View"
    room_type VARCHAR(100), -- single, double, suite, studio
    max_guests INTEGER DEFAULT 2,
    access_code VARCHAR(50), -- Individual room access code
    access_instructions TEXT, -- How to use the access code
    room_amenities JSONB, -- TV, minibar, balcony, etc.
    room_size_sqm INTEGER,
    bed_configuration VARCHAR(255), -- "1 King Bed", "2 Single Beds"
    floor_number INTEGER,
    wifi_name VARCHAR(255),
    wifi_password VARCHAR(255),
    has_balcony BOOLEAN DEFAULT FALSE,
    has_kitchen BOOLEAN DEFAULT FALSE,
    is_accessible BOOLEAN DEFAULT FALSE, -- Wheelchair accessible
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(property_id, room_number)
);

-- Reservations table (updated to reference rooms)
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beds24_booking_id VARCHAR(255) UNIQUE NOT NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    num_guests INTEGER DEFAULT 1,
    num_adults INTEGER DEFAULT 1,
    num_children INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status reservation_status DEFAULT 'pending',
    check_in_token UUID UNIQUE DEFAULT uuid_generate_v4(),
    special_requests TEXT,
    booking_source VARCHAR(100), -- Airbnb, Booking.com, Direct, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest check-ins table (updated)
CREATE TABLE guest_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    passport_url TEXT NOT NULL,
    address TEXT NOT NULL,
    estimated_checkin_time TIME NOT NULL,
    travel_purpose VARCHAR(255) NOT NULL,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    admin_verified BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Cleaning tasks table (updated to reference both property and room)
CREATE TABLE cleaning_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    cleaner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    task_date DATE NOT NULL,
    task_type VARCHAR(100) DEFAULT 'checkout_cleaning', -- checkout, checkin, maintenance, deep_clean
    status cleaning_status DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    special_notes TEXT,
    completion_photo_url TEXT,
    estimated_duration INTEGER DEFAULT 120, -- minutes
    actual_duration INTEGER, -- actual time taken
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest app content table (updated to support property and room level content)
CREATE TABLE guest_app_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, -- NULL for property-wide content
    content_type VARCHAR(100) NOT NULL, -- 'wifi', 'amenities', 'local_info', 'emergency', 'room_guide'
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_data JSONB, -- Structured data for complex content
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    language VARCHAR(5) DEFAULT 'en', -- en, es, fr, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property images table
CREATE TABLE property_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, -- NULL for property-wide images
    image_url TEXT NOT NULL,
    image_type VARCHAR(50) DEFAULT 'general', -- general, amenity, room, exterior, etc.
    caption VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook events table (unchanged)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    beds24_event_id VARCHAR(255) UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active);

CREATE INDEX idx_properties_owner_id ON properties(owner_id);
CREATE INDEX idx_properties_active ON properties(is_active);

CREATE INDEX idx_rooms_property_id ON rooms(property_id);
CREATE INDEX idx_rooms_active ON rooms(is_active);
CREATE INDEX idx_rooms_room_number ON rooms(room_number);

CREATE INDEX idx_reservations_room_id ON reservations(room_id);
CREATE INDEX idx_reservations_beds24_booking_id ON reservations(beds24_booking_id);
CREATE INDEX idx_reservations_check_in_token ON reservations(check_in_token);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_check_in_date ON reservations(check_in_date);
CREATE INDEX idx_reservations_guest_email ON reservations(guest_email);

CREATE INDEX idx_guest_checkins_reservation_id ON guest_checkins(reservation_id);
CREATE INDEX idx_guest_checkins_admin_verified ON guest_checkins(admin_verified);

CREATE INDEX idx_cleaning_tasks_reservation_id ON cleaning_tasks(reservation_id);
CREATE INDEX idx_cleaning_tasks_property_id ON cleaning_tasks(property_id);
CREATE INDEX idx_cleaning_tasks_room_id ON cleaning_tasks(room_id);
CREATE INDEX idx_cleaning_tasks_cleaner_id ON cleaning_tasks(cleaner_id);
CREATE INDEX idx_cleaning_tasks_status ON cleaning_tasks(status);
CREATE INDEX idx_cleaning_tasks_task_date ON cleaning_tasks(task_date);

CREATE INDEX idx_guest_app_content_property_id ON guest_app_content(property_id);
CREATE INDEX idx_guest_app_content_room_id ON guest_app_content(room_id);
CREATE INDEX idx_guest_app_content_type ON guest_app_content(content_type);

CREATE INDEX idx_property_images_property_id ON property_images(property_id);
CREATE INDEX idx_property_images_room_id ON property_images(room_id);

CREATE INDEX idx_webhook_events_beds24_event_id ON webhook_events(beds24_event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at 
    BEFORE UPDATE ON properties 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at 
    BEFORE UPDATE ON rooms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at 
    BEFORE UPDATE ON reservations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cleaning_tasks_updated_at 
    BEFORE UPDATE ON cleaning_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guest_app_content_updated_at 
    BEFORE UPDATE ON guest_app_content 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for verified_at in guest_checkins
CREATE OR REPLACE FUNCTION update_verified_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.admin_verified = TRUE AND OLD.admin_verified = FALSE THEN
        NEW.verified_at = NOW();
    ELSIF NEW.admin_verified = FALSE THEN
        NEW.verified_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_guest_checkins_verified_at 
    BEFORE UPDATE ON guest_checkins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_verified_at();

-- Create trigger for cleaning task completion
CREATE OR REPLACE FUNCTION update_cleaning_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cleaning_tasks_completed_at 
    BEFORE UPDATE ON cleaning_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_cleaning_completed_at();

-- Row Level Security (RLS) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_app_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policies - allow service role full access for now
CREATE POLICY "Service role can manage user_profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage properties" ON properties
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage rooms" ON rooms
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage reservations" ON reservations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage guest_checkins" ON guest_checkins
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage cleaning_tasks" ON cleaning_tasks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage guest_app_content" ON guest_app_content
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage property_images" ON property_images
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage webhook_events" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- Create storage bucket for guest documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('guest-documents', 'guest-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for property images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Service role can manage guest documents" ON storage.objects
    FOR ALL USING (bucket_id = 'guest-documents' AND auth.role() = 'service_role');

CREATE POLICY "Service role can manage property images" ON storage.objects
    FOR ALL USING (bucket_id = 'property-images' AND auth.role() = 'service_role');

-- Views for easier querying
CREATE VIEW reservations_with_details AS
SELECT 
    r.*,
    p.name as property_name,
    p.address as property_address,
    p.wifi_name,
    p.wifi_password,
    p.house_rules,
    p.check_in_instructions,
    rm.room_number,
    rm.room_name,
    rm.access_code,
    rm.access_instructions,
    rm.room_amenities,
    rm.max_guests as room_max_guests,
    gc.id as checkin_id,
    gc.passport_url,
    gc.address as guest_address,
    gc.estimated_checkin_time,
    gc.travel_purpose,
    gc.admin_verified,
    gc.submitted_at,
    gc.verified_at,
    up.first_name as verified_by_name
FROM reservations r
LEFT JOIN rooms rm ON r.room_id = rm.id
LEFT JOIN properties p ON rm.property_id = p.id
LEFT JOIN guest_checkins gc ON r.id = gc.reservation_id
LEFT JOIN user_profiles up ON gc.verified_by = up.id;

-- View for cleaning tasks with full details
CREATE VIEW cleaning_tasks_detailed AS
SELECT 
    ct.*,
    p.name as property_name,
    p.address as property_address,
    rm.room_number,
    rm.room_name,
    u.first_name as cleaner_first_name,
    u.last_name as cleaner_last_name,
    r.guest_name,
    r.check_out_date,
    r.guest_email
FROM cleaning_tasks ct
LEFT JOIN properties p ON ct.property_id = p.id
LEFT JOIN rooms rm ON ct.room_id = rm.id
LEFT JOIN user_profiles u ON ct.cleaner_id = u.id
LEFT JOIN reservations r ON ct.reservation_id = r.id;

-- View for owner statistics
CREATE VIEW owner_stats AS
SELECT 
    up.id as owner_id,
    up.first_name,
    up.last_name,
    COUNT(DISTINCT p.id) as total_properties,
    COUNT(DISTINCT rm.id) as total_rooms,
    COUNT(DISTINCT r.id) as total_reservations,
    COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_reservations,
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.total_amount END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN r.status = 'completed' THEN r.total_amount END), 0) as avg_daily_rate
FROM user_profiles up
LEFT JOIN properties p ON up.id = p.owner_id
LEFT JOIN rooms rm ON p.id = rm.property_id
LEFT JOIN reservations r ON rm.id = r.room_id
WHERE up.role = 'owner'
GROUP BY up.id, up.first_name, up.last_name;

-- Function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalReservations', (SELECT COUNT(*) FROM reservations),
        'completedCheckins', (SELECT COUNT(*) FROM reservations WHERE status = 'completed'),
        'pendingCheckins', (SELECT COUNT(*) FROM reservations WHERE status = 'invited'),
        'verifiedCheckins', (SELECT COUNT(*) FROM guest_checkins WHERE admin_verified = true),
        'todayCheckins', (SELECT COUNT(*) FROM reservations WHERE check_in_date = CURRENT_DATE),
        'upcomingCheckins', (SELECT COUNT(*) FROM reservations WHERE check_in_date > CURRENT_DATE AND check_in_date <= CURRENT_DATE + INTERVAL '7 days'),
        'totalProperties', (SELECT COUNT(*) FROM properties),
        'totalRooms', (SELECT COUNT(*) FROM rooms),
        'totalUsers', (SELECT COUNT(*) FROM user_profiles),
        'pendingCleaningTasks', (SELECT COUNT(*) FROM cleaning_tasks WHERE status = 'pending'),
        'completedCleaningTasks', (SELECT COUNT(*) FROM cleaning_tasks WHERE status = 'completed')
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get owner statistics
CREATE OR REPLACE FUNCTION get_owner_stats(owner_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
BEGIN
    SELECT json_build_object(
        'monthlyRevenue', COALESCE(SUM(CASE 
            WHEN r.status = 'completed' 
            AND r.check_in_date >= start_date 
            AND r.check_in_date <= end_date 
            THEN r.total_amount 
        END), 0),
        'occupancyRate', ROUND(
            (COUNT(CASE 
                WHEN r.check_in_date >= start_date 
                AND r.check_in_date <= end_date 
                THEN 1 
            END)::DECIMAL / EXTRACT(DAY FROM end_date)) * 100, 2
        ),
        'averageDailyRate', COALESCE(AVG(CASE 
            WHEN r.status = 'completed' 
            AND r.check_in_date >= start_date 
            AND r.check_in_date <= end_date 
            THEN r.total_amount 
        END), 0),
        'upcomingReservations', COUNT(CASE 
            WHEN r.check_in_date > CURRENT_DATE 
            AND r.check_in_date <= CURRENT_DATE + INTERVAL '7 days' 
            THEN 1 
        END),
        'totalProperties', COUNT(DISTINCT p.id),
        'totalRooms', COUNT(DISTINCT rm.id),
        'pendingCleaningTasks', COUNT(CASE 
            WHEN ct.status = 'pending' 
            THEN 1 
        END)
    ) INTO result
    FROM properties p
    LEFT JOIN rooms rm ON p.id = rm.property_id
    LEFT JOIN reservations r ON rm.id = r.room_id
    LEFT JOIN cleaning_tasks ct ON rm.id = ct.room_id
    WHERE p.owner_id = owner_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get guest dashboard data
CREATE OR REPLACE FUNCTION get_guest_dashboard_data(reservation_token UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'reservation', json_build_object(
            'id', r.id,
            'guest_name', r.guest_name,
            'check_in_date', r.check_in_date,
            'check_out_date', r.check_out_date,
            'num_guests', r.num_guests,
            'status', r.status
        ),
        'property', json_build_object(
            'name', p.name,
            'address', p.address,
            'wifi_name', p.wifi_name,
            'wifi_password', p.wifi_password,
            'house_rules', p.house_rules,
            'check_in_instructions', p.check_in_instructions,
            'emergency_contact', p.emergency_contact,
            'amenities', p.property_amenities
        ),
        'room', json_build_object(
            'room_number', rm.room_number,
            'room_name', rm.room_name,
            'access_code', rm.access_code,
            'access_instructions', rm.access_instructions,
            'amenities', rm.room_amenities,
            'max_guests', rm.max_guests,
            'bed_configuration', rm.bed_configuration
        ),
        'checkin_status', CASE 
            WHEN gc.id IS NOT NULL THEN 'completed'
            ELSE 'pending'
        END
    ) INTO result
    FROM reservations r
    LEFT JOIN rooms rm ON r.room_id = rm.id
    LEFT JOIN properties p ON rm.property_id = p.id
    LEFT JOIN guest_checkins gc ON r.id = gc.reservation_id
    WHERE r.check_in_token = reservation_token;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create cleaning task automatically
CREATE OR REPLACE FUNCTION create_cleaning_task_for_checkout()
RETURNS TRIGGER AS $$
BEGIN
    -- Create cleaning task when reservation status changes to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO cleaning_tasks (
            reservation_id,
            property_id,
            room_id,
            task_date,
            task_type,
            status
        )
        SELECT 
            NEW.id,
            rm.property_id,
            NEW.room_id,
            NEW.check_out_date,
            'checkout_cleaning',
            'pending'
        FROM rooms rm
        WHERE rm.id = NEW.room_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_cleaning_task
    AFTER UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION create_cleaning_task_for_checkout();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_owner_stats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_guest_dashboard_data(UUID) TO service_role;

-- Sample data for testing
INSERT INTO user_profiles (id, role, first_name, last_name, phone) VALUES
('c339d395-9910-44cd-ae8a-362e153c35de', 'admin', 'Admin', 'User', '+1234567890'),
('15a1fa4e-c6ab-4e78-9a08-9cf5c8c1a23c', 'owner', 'John', 'Smith', '+1234567891'),
('6a132282-5441-4648-a983-fa85cc42db07', 'cleaner', 'Maria', 'Garcia', '+1234567892');

-- Sample property
INSERT INTO properties (id, name, address, owner_id, total_rooms, wifi_name, wifi_password, house_rules, check_in_instructions) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'Sunset Beach Resort', '123 Ocean Drive, Miami Beach, FL 33139', '15a1fa4e-c6ab-4e78-9a08-9cf5c8c1a23c', 22, 'SunsetBeach_WiFi', 'beach2024!', 'No smoking, No pets, Quiet hours 10PM-8AM', 'Check-in is at the front desk. Use your room access code for entry.');

-- Sample rooms for the property
INSERT INTO rooms (property_id, room_number, room_name, max_guests, access_code, room_amenities, bed_configuration) VALUES
('660e8400-e29b-41d4-a716-446655440000', '101', 'Ocean View Suite', 4, '1234', '{"tv": true, "minibar": true, "balcony": true, "ocean_view": true}', '1 King Bed + Sofa Bed'),
('660e8400-e29b-41d4-a716-446655440000', '102', 'Standard Room', 2, '5678', '{"tv": true, "minibar": false, "balcony": false, "ocean_view": false}', '1 Queen Bed'),
('660e8400-e29b-41d4-a716-446655440000', '201', 'Deluxe Suite', 6, '9012', '{"tv": true, "minibar": true, "balcony": true, "ocean_view": true, "kitchen": true}', '2 Queen Beds + Sofa Bed');

-- Sample reservations
INSERT INTO reservations (beds24_booking_id, room_id, guest_name, guest_email, check_in_date, check_out_date, num_guests, total_amount, status) VALUES
('BK001', (SELECT id FROM rooms WHERE room_number = '101'), 'John Smith', 'john.smith@example.com', '2025-01-28', '2025-01-30', 2, 299.99, 'invited'),
('BK002', (SELECT id FROM rooms WHERE room_number = '102'), 'Sarah Johnson', 'sarah.johnson@example.com', '2025-01-29', '2025-02-01', 1, 199.99, 'invited'),
('BK003', (SELECT id FROM rooms WHERE room_number = '201'), 'Michael Brown', 'michael.brown@example.com', '2025-01-30', '2025-02-03', 4, 399.99, 'invited');

COMMENT ON TABLE user_profiles IS 'User profiles linked to Supabase Auth users';
COMMENT ON TABLE properties IS 'Properties/buildings owned by users';
COMMENT ON TABLE rooms IS 'Individual rooms within properties';
COMMENT ON TABLE reservations IS 'Reservations linked to specific rooms';
COMMENT ON TABLE guest_checkins IS 'Guest check-in form submissions';
COMMENT ON TABLE cleaning_tasks IS 'Cleaning tasks for rooms';
COMMENT ON TABLE guest_app_content IS 'Content displayed in guest app';
COMMENT ON TABLE property_images IS 'Images for properties and rooms';
COMMENT ON VIEW reservations_with_details IS 'Complete reservation information with property and room details';
