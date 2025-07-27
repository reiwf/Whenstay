-- Whenstay Check-in App Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE reservation_status AS ENUM ('pending', 'invited', 'completed', 'cancelled');
CREATE TYPE user_role AS ENUM ('admin', 'owner', 'guest', 'cleaner');
CREATE TYPE cleaning_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Users table for multi-role system
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Apartments/Properties table
CREATE TABLE apartments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    room_number VARCHAR(50),
    max_guests INTEGER DEFAULT 2,
    wifi_name VARCHAR(255),
    wifi_password VARCHAR(255),
    access_code VARCHAR(50),
    house_rules TEXT,
    check_in_instructions TEXT,
    amenities JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cleaning tasks table
CREATE TABLE cleaning_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    cleaner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    task_date DATE NOT NULL,
    task_type VARCHAR(100) DEFAULT 'checkout_cleaning',
    status cleaning_status DEFAULT 'pending',
    special_notes TEXT,
    completion_photo_url TEXT,
    estimated_duration INTEGER DEFAULT 120, -- minutes
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest app content table
CREATE TABLE guest_app_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    content_type VARCHAR(100) NOT NULL, -- 'wifi', 'amenities', 'local_info', 'emergency'
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservations table
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beds24_booking_id VARCHAR(255) UNIQUE NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    room_number VARCHAR(50),
    num_guests INTEGER DEFAULT 1,
    total_amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    status reservation_status DEFAULT 'pending',
    check_in_token UUID UNIQUE DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guest check-ins table
CREATE TABLE guest_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    passport_url TEXT NOT NULL,
    address TEXT NOT NULL,
    estimated_checkin_time TIME NOT NULL,
    travel_purpose VARCHAR(255) NOT NULL,
    admin_verified BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Webhook events table
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
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_apartments_owner_id ON apartments(owner_id);
CREATE INDEX idx_cleaning_tasks_reservation_id ON cleaning_tasks(reservation_id);
CREATE INDEX idx_cleaning_tasks_apartment_id ON cleaning_tasks(apartment_id);
CREATE INDEX idx_cleaning_tasks_cleaner_id ON cleaning_tasks(cleaner_id);
CREATE INDEX idx_cleaning_tasks_status ON cleaning_tasks(status);
CREATE INDEX idx_cleaning_tasks_task_date ON cleaning_tasks(task_date);
CREATE INDEX idx_guest_app_content_apartment_id ON guest_app_content(apartment_id);
CREATE INDEX idx_guest_app_content_type ON guest_app_content(content_type);
CREATE INDEX idx_reservations_beds24_booking_id ON reservations(beds24_booking_id);
CREATE INDEX idx_reservations_check_in_token ON reservations(check_in_token);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_check_in_date ON reservations(check_in_date);
CREATE INDEX idx_guest_checkins_reservation_id ON guest_checkins(reservation_id);
CREATE INDEX idx_guest_checkins_admin_verified ON guest_checkins(admin_verified);
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

-- Create trigger for reservations table
CREATE TRIGGER update_reservations_updated_at 
    BEFORE UPDATE ON reservations 
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

-- Add triggers for new tables
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apartments_updated_at 
    BEFORE UPDATE ON apartments 
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
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_app_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policies for new tables - allow service role full access
CREATE POLICY "Service role can manage users" ON users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage apartments" ON apartments
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage cleaning_tasks" ON cleaning_tasks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage guest_app_content" ON guest_app_content
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for reservations - allow service role full access
CREATE POLICY "Service role can manage reservations" ON reservations
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for guest_checkins - allow service role full access
CREATE POLICY "Service role can manage guest_checkins" ON guest_checkins
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for webhook_events - allow service role full access
CREATE POLICY "Service role can manage webhook_events" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- Create storage bucket for guest documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('guest-documents', 'guest-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for guest documents
CREATE POLICY "Service role can manage guest documents" ON storage.objects
    FOR ALL USING (bucket_id = 'guest-documents' AND auth.role() = 'service_role');

-- Create some sample data for testing (optional)
-- Uncomment the following lines if you want sample data

/*
INSERT INTO reservations (
    beds24_booking_id, 
    guest_name, 
    guest_email, 
    check_in_date, 
    check_out_date, 
    room_number, 
    status
) VALUES 
(
    'sample-booking-001', 
    'John Doe', 
    'john.doe@example.com', 
    CURRENT_DATE + INTERVAL '1 day', 
    CURRENT_DATE + INTERVAL '3 days', 
    '101', 
    'invited'
),
(
    'sample-booking-002', 
    'Jane Smith', 
    'jane.smith@example.com', 
    CURRENT_DATE + INTERVAL '2 days', 
    CURRENT_DATE + INTERVAL '5 days', 
    '102', 
    'pending'
);
*/

-- Views for easier querying
CREATE VIEW reservations_with_checkins AS
SELECT 
    r.*,
    gc.id as checkin_id,
    gc.passport_url,
    gc.address,
    gc.estimated_checkin_time,
    gc.travel_purpose,
    gc.admin_verified,
    gc.submitted_at,
    gc.verified_at
FROM reservations r
LEFT JOIN guest_checkins gc ON r.id = gc.reservation_id;

-- View for cleaning tasks with apartment and cleaner info
CREATE VIEW cleaning_tasks_detailed AS
SELECT 
    ct.*,
    a.name as apartment_name,
    a.address as apartment_address,
    u.first_name as cleaner_first_name,
    u.last_name as cleaner_last_name,
    u.email as cleaner_email,
    r.guest_name,
    r.check_out_date
FROM cleaning_tasks ct
LEFT JOIN apartments a ON ct.apartment_id = a.id
LEFT JOIN users u ON ct.cleaner_id = u.id
LEFT JOIN reservations r ON ct.reservation_id = r.id;

-- View for owner statistics
CREATE VIEW owner_stats AS
SELECT 
    u.id as owner_id,
    u.first_name,
    u.last_name,
    u.email,
    COUNT(DISTINCT a.id) as total_apartments,
    COUNT(DISTINCT r.id) as total_reservations,
    COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as completed_reservations,
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.total_amount END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN r.status = 'completed' THEN r.total_amount END), 0) as avg_daily_rate
FROM users u
LEFT JOIN apartments a ON u.id = a.owner_id
LEFT JOIN reservations r ON a.room_number = r.room_number
WHERE u.role = 'owner'
GROUP BY u.id, u.first_name, u.last_name, u.email;

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
        'totalUsers', (SELECT COUNT(*) FROM users),
        'totalApartments', (SELECT COUNT(*) FROM apartments),
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
        'totalApartments', COUNT(DISTINCT a.id),
        'pendingCleaningTasks', COUNT(CASE 
            WHEN ct.status = 'pending' 
            THEN 1 
        END)
    ) INTO result
    FROM apartments a
    LEFT JOIN reservations r ON a.room_number = r.room_number
    LEFT JOIN cleaning_tasks ct ON a.id = ct.apartment_id
    WHERE a.owner_id = owner_uuid;
    
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
            apartment_id,
            task_date,
            task_type,
            status
        )
        SELECT 
            NEW.id,
            a.id,
            NEW.check_out_date,
            'checkout_cleaning',
            'pending'
        FROM apartments a
        WHERE a.room_number = NEW.room_number;
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

COMMENT ON TABLE reservations IS 'Stores reservation data from Beds24';
COMMENT ON TABLE guest_checkins IS 'Stores guest check-in form submissions';
COMMENT ON TABLE webhook_events IS 'Logs webhook events from Beds24';
COMMENT ON VIEW reservations_with_checkins IS 'Combined view of reservations and their check-in data';
