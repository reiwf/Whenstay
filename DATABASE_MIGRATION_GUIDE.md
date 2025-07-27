# Database Migration Guide: V1 to V2

## Overview

This guide explains the migration from the original Whenstay database schema (V1) to the new improved schema (V2) that integrates with Supabase Auth and implements a proper Property/Room structure.

## Key Changes

### 1. Authentication Migration
**From:** Custom `users` table with password hashing
**To:** Supabase Auth + `user_profiles` table

### 2. Property Structure Redesign
**From:** Single `apartments` table
**To:** `properties` + `rooms` tables

### 3. Enhanced Features
- Room-specific access codes
- Property and room-level content
- Better cleaning task management
- Improved guest dashboard experience

## New Database Structure

### Core Tables

#### `user_profiles`
- References `auth.users.id` from Supabase Auth
- Stores user roles and profile information
- Replaces the custom `users` table

#### `properties`
- Represents main properties/buildings
- Example: "Sunset Beach Resort" with 22 rooms
- Contains property-wide information (WiFi, house rules, etc.)

#### `rooms`
- Individual rooms within properties
- Each room has unique access code
- Room-specific amenities and information

#### `reservations`
- Now references specific `room_id` instead of room number
- Enhanced with guest details and booking source

## Migration Steps

### Step 1: Backup Current Data
```sql
-- Create backup of existing data
CREATE TABLE users_backup AS SELECT * FROM users;
CREATE TABLE apartments_backup AS SELECT * FROM apartments;
CREATE TABLE reservations_backup AS SELECT * FROM reservations;
```

### Step 2: Run New Schema
```sql
-- Run the new schema
\i backend/database/schema_v2.sql
```

### Step 3: Migrate Users to Supabase Auth
For each existing user:
1. Create user in Supabase Auth (via dashboard or API)
2. Get the new `auth.users.id`
3. Insert into `user_profiles` table

```javascript
// Example using Supabase client
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'temporary_password',
  email_confirm: true
});

// Then insert into user_profiles
await supabase.from('user_profiles').insert({
  id: data.user.id,
  role: 'owner',
  first_name: 'John',
  last_name: 'Smith',
  phone: '+1234567890'
});
```

### Step 4: Migrate Apartments to Properties/Rooms
```sql
-- Run the migration function
SELECT migrate_apartments_to_properties_and_rooms();
```

### Step 5: Update Application Code
Update your application to use the new schema structure.

## New Guest Dashboard Experience

With the new structure, guests will see:

### Property Information
- Property name: "Sunset Beach Resort"
- Address and location
- Property-wide amenities
- WiFi credentials
- House rules

### Room-Specific Information
- Room number: "101"
- Room name: "Ocean View Suite"
- Access code: "1234"
- Room amenities: TV, minibar, balcony
- Bed configuration: "1 King Bed + Sofa Bed"

### Example Guest Dashboard Data
```json
{
  "reservation": {
    "guest_name": "John Smith",
    "check_in_date": "2025-01-28",
    "check_out_date": "2025-01-30",
    "num_guests": 2
  },
  "property": {
    "name": "Sunset Beach Resort",
    "address": "123 Ocean Drive, Miami Beach, FL 33139",
    "wifi_name": "SunsetBeach_WiFi",
    "wifi_password": "beach2024!",
    "amenities": ["Pool", "Gym", "Beach Access"]
  },
  "room": {
    "room_number": "101",
    "room_name": "Ocean View Suite",
    "access_code": "1234",
    "amenities": {
      "tv": true,
      "minibar": true,
      "balcony": true,
      "ocean_view": true
    }
  }
}
```

## API Updates Required

### 1. Update Guest Dashboard API
```javascript
// New function to get guest dashboard data
app.get('/api/guest/:token', async (req, res) => {
  const { data } = await supabase.rpc('get_guest_dashboard_data', {
    reservation_token: req.params.token
  });
  res.json(data);
});
```

### 2. Update Admin Dashboard
```javascript
// Updated to use new views
app.get('/api/admin/reservations', async (req, res) => {
  const { data } = await supabase
    .from('reservations_with_details')
    .select('*')
    .order('check_in_date', { ascending: true });
  res.json(data);
});
```

### 3. Update Property Management
```javascript
// Create property with rooms
app.post('/api/admin/properties', async (req, res) => {
  const { property, rooms } = req.body;
  
  // Create property
  const { data: propertyData } = await supabase
    .from('properties')
    .insert(property)
    .select()
    .single();
  
  // Create rooms
  const roomsWithPropertyId = rooms.map(room => ({
    ...room,
    property_id: propertyData.id
  }));
  
  await supabase.from('rooms').insert(roomsWithPropertyId);
  
  res.json({ success: true, property: propertyData });
});
```

## Frontend Updates Required

### 1. Update Guest Dashboard Component
```jsx
// Enhanced guest dashboard showing room details
const GuestDashboard = ({ token }) => {
  const [dashboardData, setDashboardData] = useState(null);
  
  useEffect(() => {
    fetch(`/api/guest/${token}`)
      .then(res => res.json())
      .then(data => setDashboardData(data));
  }, [token]);
  
  if (!dashboardData) return <LoadingSpinner />;
  
  const { reservation, property, room } = dashboardData;
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1>Welcome to {property.name}</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2>Your Room</h2>
          <p><strong>Room:</strong> {room.room_number} - {room.room_name}</p>
          <p><strong>Access Code:</strong> {room.access_code}</p>
          <p><strong>Beds:</strong> {room.bed_configuration}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2>Property Information</h2>
          <p><strong>WiFi:</strong> {property.wifi_name}</p>
          <p><strong>Password:</strong> {property.wifi_password}</p>
          <p><strong>Address:</strong> {property.address}</p>
        </div>
      </div>
    </div>
  );
};
```

### 2. Update Admin Property Management
```jsx
// Property management with room creation
const PropertyForm = () => {
  const [property, setProperty] = useState({});
  const [rooms, setRooms] = useState([]);
  
  const addRoom = () => {
    setRooms([...rooms, {
      room_number: '',
      room_name: '',
      access_code: '',
      max_guests: 2
    }]);
  };
  
  const handleSubmit = async () => {
    await fetch('/api/admin/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property, rooms })
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Property fields */}
      <input 
        placeholder="Property Name"
        value={property.name}
        onChange={e => setProperty({...property, name: e.target.value})}
      />
      
      {/* Room management */}
      <h3>Rooms</h3>
      {rooms.map((room, index) => (
        <div key={index} className="border p-4 mb-4">
          <input 
            placeholder="Room Number"
            value={room.room_number}
            onChange={e => {
              const newRooms = [...rooms];
              newRooms[index].room_number = e.target.value;
              setRooms(newRooms);
            }}
          />
          <input 
            placeholder="Access Code"
            value={room.access_code}
            onChange={e => {
              const newRooms = [...rooms];
              newRooms[index].access_code = e.target.value;
              setRooms(newRooms);
            }}
          />
        </div>
      ))}
      
      <button type="button" onClick={addRoom}>Add Room</button>
      <button type="submit">Create Property</button>
    </form>
  );
};
```

## Testing the Migration

### 1. Verify Data Migration
```sql
-- Check that all data migrated correctly
SELECT 
  p.name as property_name,
  COUNT(r.id) as room_count,
  COUNT(res.id) as reservation_count
FROM properties p
LEFT JOIN rooms r ON p.id = r.property_id
LEFT JOIN reservations res ON r.id = res.room_id
GROUP BY p.id, p.name;
```

### 2. Test Guest Dashboard
```bash
# Test the new guest dashboard endpoint
curl http://localhost:3001/api/guest/[check_in_token]
```

### 3. Test Property Creation
```bash
# Test creating a new property with rooms
curl -X POST http://localhost:3001/api/admin/properties \
  -H "Content-Type: application/json" \
  -d '{
    "property": {
      "name": "Test Property",
      "address": "123 Test St",
      "owner_id": "550e8400-e29b-41d4-a716-446655440001"
    },
    "rooms": [
      {
        "room_number": "101",
        "room_name": "Standard Room",
        "access_code": "1234",
        "max_guests": 2
      }
    ]
  }'
```

## Rollback Plan

If issues occur during migration:

1. **Stop the application**
2. **Restore from backup**
```sql
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Restore original tables
CREATE TABLE users AS SELECT * FROM users_backup;
CREATE TABLE apartments AS SELECT * FROM apartments_backup;
-- Restore other tables as needed
```

3. **Restart with original schema**

## Benefits of New Structure

### For Property Owners
- Manage multiple properties with many rooms
- Room-specific access codes and amenities
- Better analytics per property and room
- Scalable for large properties (hotels, resorts)

### For Guests
- Clear room assignment and access information
- Room-specific guides and amenities
- Property-wide information (WiFi, rules, etc.)
- Better mobile experience

### For Cleaners
- Room-specific cleaning tasks
- Property and room context
- Better task organization

### For Admins
- Comprehensive property management
- Room-level analytics
- Better user management with Supabase Auth
- Enhanced security and scalability

## Next Steps

1. **Review the new schema** in `schema_v2.sql`
2. **Test migration** on a development environment
3. **Update application code** to use new structure
4. **Plan production migration** during low-traffic period
5. **Monitor and verify** all functionality post-migration

## Support

For questions or issues during migration:
- Review the migration logs
- Check the new database functions and views
- Test with the provided sample data
- Verify API endpoints return expected data structure
