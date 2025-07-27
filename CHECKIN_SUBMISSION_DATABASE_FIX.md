# Check-in Submission Database Fix

## Issue
Online check-in submission is failing with database errors due to missing columns and improper null handling.

## Root Cause Analysis

### 1. Database Schema Issues
- The `schema_v3.sql` file has duplicate `reservations` table definitions
- Some columns are missing from the first definition: `booking_source`, `num_adults`, `num_children`, `special_requests`
- The database may not have been updated with all the new columns

### 2. Data Handling Issues
- Empty strings being sent instead of `null` for optional fields
- Time field validation failing when empty string is provided
- Boolean field conversion not handled properly

## Fields Required for Check-in Submission

Based on the original task, these fields should be updated during online check-in:

```sql
-- Guest Information (from Step 2)
guest_firstname character varying(255) null,
guest_lastname character varying(255) null,
guest_contact character varying(50) null,
guest_personal_email character varying(255) null,
guest_address text null,

-- Check-in Details (from Step 2)
estimated_checkin_time time without time zone null,
travel_purpose character varying(255) null,

-- Document Upload (from Step 3)
passport_url text null,

-- Emergency Contact (from Step 2)
emergency_contact_name character varying(255) null,
emergency_contact_phone character varying(50) null,

-- Agreement (from Step 4)
agreement_accepted boolean null default false,

-- System Fields
checkin_submitted_at timestamp with time zone null,
```

## Fixes Applied

### 1. Database Service Fix
- Updated `updateReservationGuestInfo` method to properly handle null values
- Convert empty strings to `null` for database compatibility
- Proper boolean field handling
- Added error logging for debugging

### 2. Frontend Modal Fix
- Updated ReservationModal to include all missing fields
- Proper null handling in form submission
- Fixed icon import issues

## Next Steps

1. Verify database schema has all required columns
2. Test check-in submission flow
3. Ensure proper error handling and validation

## Database Migration Required

If the database is missing any columns, run the following migration:

```sql
-- Add missing columns if they don't exist
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_source text null;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS num_adults integer null;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS num_children integer null;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS special_requests text null;
