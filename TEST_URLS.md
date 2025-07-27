# 🧪 Test URLs for Whenstay Check-in System

## 📋 Test Reservations Available

### 1. John Smith - Room 101
- **Check-in URL**: http://localhost:3000/checkin/851fd7de-0e34-44f7-afcd-78b3c5fed99d
- **Guest**: John Smith (john.smith@example.com)
- **Dates**: Jan 28-30, 2025
- **Guests**: 2 people
- **Amount**: $250.00

### 2. Sarah Johnson - Room 102
- **Check-in URL**: http://localhost:3000/checkin/2e71d017-b6b8-496d-846a-ab10cc0be4ec
- **Guest**: Sarah Johnson (sarah.johnson@example.com)
- **Dates**: Jan 29 - Feb 1, 2025
- **Guests**: 1 person
- **Amount**: $180.00

### 3. Michael Brown - Room 201
- **Check-in URL**: http://localhost:3000/checkin/b32469c5-fed6-4d98-ae09-f847e63e708d
- **Guest**: Michael Brown (michael.brown@example.com)
- **Dates**: Jan 30 - Feb 2, 2025
- **Guests**: 3 people
- **Amount**: $320.00

## 🔗 Other Test URLs

- **Homepage**: http://localhost:3000
- **Admin Login**: http://localhost:3000/admin
- **Owner Login**: http://localhost:3000/owner
- **Cleaner Login**: http://localhost:3000/cleaner

## 🧪 API Test Endpoints

- **Get Test Reservations**: http://localhost:3001/api/test/reservations
- **Get Dashboard Stats**: http://localhost:3001/api/test/dashboard/stats
- **Get Check-ins**: http://localhost:3001/api/test/checkins

## 📝 How to Test

1. **Online Check-in Flow**:
   - Click on any of the check-in URLs above
   - Fill out the guest check-in form
   - Upload a document (any image file)
   - Submit the form
   - See the confirmation page

2. **Guest Dashboard**:
   - After completing check-in, you'll be redirected to the guest dashboard
   - View reservation details, check-in instructions, and support options

3. **Admin Dashboard**:
   - Go to http://localhost:3000/admin
   - Login with: admin / admin123
   - View completed check-ins and dashboard statistics

## 🎯 Test Scenarios

### Scenario 1: Complete Check-in Process
1. Use John Smith's check-in URL
2. Fill out the form with test data
3. Upload a sample document
4. Complete the check-in
5. View the guest dashboard

### Scenario 2: Admin Verification
1. Complete a check-in (Scenario 1)
2. Login to admin dashboard
3. View the completed check-in
4. Verify the guest information

### Scenario 3: Multiple Reservations
1. Complete check-ins for all three test guests
2. View the admin dashboard to see all check-ins
3. Check the statistics updates

## 📱 Mobile Testing
All URLs work on mobile devices. Test the responsive design by:
- Opening check-in URLs on mobile
- Testing the admin dashboard on tablet/mobile
- Verifying form submissions work on touch devices
