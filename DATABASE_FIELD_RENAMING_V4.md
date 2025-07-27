# Database Field Renaming Implementation - Schema V4

## Overview
This document outlines the comprehensive field renaming implementation that updates the database schema from V3 to V4, changing guest/booking related field names for better semantic clarity.

## Field Mapping Changes

### Reservations Table Field Renaming
| Old Field Name (V3) | New Field Name (V4) | Description |
|---------------------|---------------------|-------------|
| `guest_name` | `booking_name` | Name from booking system (Beds24) |
| `guest_email` | `booking_email` | Email from booking system (Beds24) |
| `guest_phone` | `booking_phone` | Phone from booking system (Beds24) |
| `guest_personal_email` | `guest_mail` | Personal email collected during check-in |

### Semantic Clarification
- **Booking fields**: Information from the original booking (Beds24)
- **Guest fields**: Information collected during the check-in process

## Implementation Summary

### Phase 1: Database Schema Updates ✅
1. **Migration Script**: `migration_v3_to_v4.sql`
   - Renames columns in reservations table
   - Updates indexes to reflect new column names
   - Recreates `reservations_with_details` view with updated field names

2. **New Schema**: `schema_v4.sql`
   - Complete schema with new field names
   - Updated view definitions
   - Maintained all constraints and indexes

### Phase 2: Backend Code Updates ✅
1. **Database Service** (`databaseService.js`)
   - Updated `createReservation()` method to use new field names
   - Updated `updateReservationGuestInfo()` method for `guest_mail`
   - Added backward compatibility for both old and new field names

2. **API Routes** (`checkin.js`)
   - Updated API responses to use new field names
   - Updated email service calls with new field names
   - Maintained consistent field mapping throughout

3. **External Services** (`beds24Service.js`)
   - Added both old and new field names for backward compatibility
   - Updated `processWebhookData()` to return both field sets
   - Ensured smooth transition without breaking existing integrations

### Phase 3: Frontend Code Updates (Pending)
The following frontend files will need updates:
1. **API Service Layer** (`api.js`)
2. **Check-in Components**:
   - `Step1ReservationOverview.jsx`
   - `Step2GuestInformation.jsx`
3. **Admin Components**:
   - `ReservationModal.jsx`
   - `ReservationsTab.jsx`
4. **Hooks**:
   - `useCheckinProcess.js`
   - `useReservations.js`

## Database Migration Instructions

### Running the Migration
```sql
-- Execute the migration script
\i backend/database/migration_v3_to_v4.sql
```

### Verification Queries
```sql
-- Verify column names
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'reservations' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'reservations' AND schemaname = 'public';

-- Test the updated view
SELECT booking_name, booking_email, guest_mail 
FROM reservations_with_details 
LIMIT 5;
```

## Backward Compatibility

### Service Layer Compatibility
- `beds24Service.js` returns both old and new field names
- `databaseService.js` accepts both field name formats
- Gradual migration approach prevents breaking changes

### API Response Format
```json
{
  "reservation": {
    "id": "uuid",
    "guestName": "booking_name_value",     // Maps to booking_name
    "guestEmail": "booking_email_value",   // Maps to booking_email
    "guestPhone": "booking_phone_value",   // Maps to booking_phone
    "checkInDate": "2025-01-15",
    "checkOutDate": "2025-01-17"
  }
}
```

## Testing Checklist

### Database Level
- [ ] Migration script executes without errors
- [ ] All indexes are properly recreated
- [ ] View returns correct data with new field names
- [ ] Foreign key constraints remain intact

### Backend Level
- [ ] Reservation creation works with new field names
- [ ] Guest information updates use `guest_mail` field
- [ ] API responses include correct field mappings
- [ ] Email services receive correct field values

### Frontend Level (Pending)
- [ ] Check-in flow displays correct booking information
- [ ] Guest information form submits to correct fields
- [ ] Admin dashboard shows updated field names
- [ ] Reservation modals use new field structure

## Rollback Plan

### Emergency Rollback
If issues arise, the migration can be rolled back:

```sql
BEGIN;

-- Rename columns back to original names
ALTER TABLE public.reservations 
  RENAME COLUMN booking_name TO guest_name;

ALTER TABLE public.reservations 
  RENAME COLUMN booking_email TO guest_email;

ALTER TABLE public.reservations 
  RENAME COLUMN booking_phone TO guest_phone;

ALTER TABLE public.reservations 
  RENAME COLUMN guest_mail TO guest_personal_email;

-- Recreate original indexes
DROP INDEX IF EXISTS idx_reservations_booking_email;
CREATE INDEX idx_reservations_guest_email ON public.reservations USING btree (guest_email);

-- Recreate original view (use schema_v3.sql view definition)

COMMIT;
```

## Performance Impact

### Minimal Performance Impact
- Column renaming is a metadata operation
- Indexes are recreated with same structure
- View recreation maintains same query performance
- No data migration required

### Monitoring Points
- Check query performance on `reservations_with_details` view
- Monitor API response times for reservation endpoints
- Verify email service functionality

## Security Considerations

### Data Integrity
- All foreign key constraints maintained
- No data loss during migration
- Transactional migration ensures consistency

### Access Control
- No changes to row-level security policies
- Existing user permissions remain intact
- API authentication unchanged

## Next Steps

1. **Complete Frontend Updates**: Update all frontend components to use new field names
2. **Update Documentation**: Revise API documentation with new field names
3. **Monitor Production**: Watch for any issues after deployment
4. **Remove Backward Compatibility**: After stable period, remove old field name support

## Files Modified

### Database Files
- `backend/database/migration_v3_to_v4.sql` (new)
- `backend/database/schema_v4.sql` (new)

### Backend Files
- `backend/services/databaseService.js` (updated)
- `backend/routes/checkin.js` (updated)
- `backend/services/beds24Service.js` (updated)

### Documentation Files
- `DATABASE_FIELD_RENAMING_V4.md` (new)

## Contact Information
For questions or issues related to this migration, contact the development team.

---
**Migration Date**: January 27, 2025  
**Schema Version**: V4  
**Status**: Backend Complete, Frontend Pending
