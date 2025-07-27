# Guest Information Collection Implementation

## Overview
This document outlines the implementation of comprehensive guest information collection during the online check-in process, with automatic database updates when guests press the "Continue" button.

## Database Schema
The `reservations` table in `schema_v3.sql` already includes all required fields:

```sql
-- Guest Information Fields
guest_lastname character varying(255) null,
guest_firstname character varying(255) null,
guest_contact character varying(50) null,
guest_personal_email character varying(255) null,
passport_url text null,
guest_address text null,
estimated_checkin_time time without time zone null,
travel_purpose character varying(255) null,
emergency_contact_name character varying(255) null,
emergency_contact_phone character varying(50) null,
agreement_accepted boolean null default false,
checkin_submitted_at timestamp with time zone null,
```

## Implementation Details

### Frontend Changes

#### 1. Enhanced Step2GuestInformation Component
**File:** `frontend/src/components/checkin/steps/Step2GuestInformation.jsx`

**New Fields Added:**
- Personal Email (optional)
- Alternative Contact Number (optional)
- Home Address
- Estimated Check-in Time (time picker)
- Purpose of Travel (dropdown)
- Emergency Contact Name
- Emergency Contact Phone

**Form Structure:**
```
Basic Information (Required):
├── First Name *
├── Last Name *
├── Email Address *
└── Phone Number *

Additional Information (Optional):
├── Personal Email
├── Alternative Contact Number
├── Home Address
├── Estimated Check-in Time
└── Purpose of Travel

Emergency Contact (Optional):
├── Emergency Contact Name
└── Emergency Contact Phone
```

#### 2. Updated useCheckinProcess Hook
**File:** `frontend/src/hooks/useCheckinProcess.js`

**Enhanced formData State:**
```javascript
const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  personalEmail: '',
  contactNumber: '',
  address: '',
  estimatedCheckinTime: '',
  travelPurpose: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  passportFile: null,
  passportUrl: null,
  agreementAccepted: false
})
```

**Enhanced Submission Data:**
All new fields are now included in the submission payload sent to the backend.

### Backend Changes

#### 1. New Database Service Method
**File:** `backend/services/databaseService.js`

**New Method:** `updateReservationGuestInfo(reservationId, guestInfo)`
- Updates the reservations table with all guest information
- Maps frontend field names to database column names
- Handles optional fields gracefully
- Sets `checkin_submitted_at` timestamp

**Field Mapping:**
```javascript
const updateData = {
  guest_firstname: guestInfo.firstName,
  guest_lastname: guestInfo.lastName,
  guest_personal_email: guestInfo.personalEmail,
  guest_contact: guestInfo.contactNumber,
  guest_address: guestInfo.address,
  estimated_checkin_time: guestInfo.estimatedCheckinTime,
  travel_purpose: guestInfo.travelPurpose,
  emergency_contact_name: guestInfo.emergencyContactName,
  emergency_contact_phone: guestInfo.emergencyContactPhone,
  passport_url: guestInfo.passportUrl,
  agreement_accepted: guestInfo.agreementAccepted,
  checkin_submitted_at: guestInfo.submittedAt
};
```

#### 2. Updated Check-in Submission Route
**File:** `backend/routes/checkin.js`

**Enhanced POST /:token/submit endpoint:**
- Accepts all new guest information fields
- Calls `updateReservationGuestInfo()` to update the database
- Maintains backward compatibility with test mode
- Proper error handling and validation

## Data Flow

### 1. Guest Information Collection
1. Guest navigates to Step 2 (Guest Information)
2. Form displays all required and optional fields
3. Guest fills out information
4. Client-side validation ensures required fields are completed
5. Guest clicks "Continue" button

### 2. Database Update Process
1. Frontend sends complete guest information to backend
2. Backend validates the data
3. `updateReservationGuestInfo()` method updates the reservations table
4. `passport_url` is stored as bucket URL link
5. `checkin_submitted_at` timestamp is set
6. `agreement_accepted` is set when guest accepts terms

### 3. Submission Flow
```
Step 2: Guest Info → Continue Button → Database Update
Step 3: Document Upload → Passport URL → Database Update
Step 4: Agreement → Accept → Final Submission
```

## Key Features

### 1. Progressive Data Saving
- Guest information is saved when moving from Step 2 to Step 3
- Passport URL is updated during document upload
- Agreement acceptance is recorded in final step

### 2. Flexible Field Requirements
- Core fields (name, email, phone) are required
- Additional information fields are optional
- Emergency contact information is optional but recommended

### 3. Data Validation
- Email format validation
- Phone number format validation
- Required field validation
- Backend validation with express-validator

### 4. User Experience
- Clear field labels with icons
- Helpful placeholder text
- Validation error messages
- Section dividers for better organization

## Travel Purpose Options
- Business
- Leisure/Vacation
- Family Visit
- Medical
- Education
- Other

## Time Format
- Estimated check-in time uses HTML5 time input
- Stored as `time without time zone` in database
- 24-hour format (HH:MM)

## Error Handling
- Frontend validation prevents submission of invalid data
- Backend validation provides detailed error messages
- Database errors are caught and logged
- Graceful fallback to test mode when database unavailable

## Testing
- Test mode continues to work without database
- All new fields are included in test responses
- Backward compatibility maintained

## Security Considerations
- Input sanitization on all fields
- SQL injection prevention through parameterized queries
- File upload validation for passport documents
- HTTPS required for sensitive data transmission

## Future Enhancements
- Field-level auto-save as user types
- Pre-population from previous stays
- Integration with identity verification services
- Multi-language support for travel purpose options
