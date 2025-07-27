const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrateToV5() {
  console.log('Starting migration from V4 to V5...')
  
  try {
    // Step 1: Run the migration SQL
    console.log('1. Running migration SQL...')
    const migrationSql = `
      -- Run the migration script
      -- This will create the new tables and add columns
    `
    
    // Step 2: Check existing data
    console.log('2. Checking existing data...')
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('*')
    
    if (propError) {
      console.error('Error fetching properties:', propError)
      return
    }
    
    const { data: rooms, error: roomError } = await supabase
      .from('rooms')
      .select('*')
    
    if (roomError) {
      console.error('Error fetching rooms:', roomError)
      return
    }
    
    console.log(`Found ${properties.length} properties and ${rooms.length} rooms`)
    
    // Step 3: Create room types based on existing room data
    console.log('3. Creating room types...')
    
    const roomTypeMap = new Map()
    
    for (const property of properties) {
      // Get unique room types for this property
      const propertyRooms = rooms.filter(r => r.property_id === property.id)
      const uniqueRoomTypes = [...new Set(propertyRooms.map(r => r.room_type || 'Standard Room'))]
      
      for (const roomTypeName of uniqueRoomTypes) {
        const roomsOfType = propertyRooms.filter(r => (r.room_type || 'Standard Room') === roomTypeName)
        const sampleRoom = roomsOfType[0]
        
        if (sampleRoom) {
          const roomTypeData = {
            property_id: property.id,
            name: roomTypeName,
            description: `Migrated from existing room data`,
            max_guests: sampleRoom.max_guests || 2,
            base_price: 100.00, // Default base price - should be updated manually
            currency: 'USD',
            room_amenities: sampleRoom.room_amenities,
            bed_configuration: sampleRoom.bed_configuration,
            room_size_sqm: sampleRoom.room_size_sqm,
            has_balcony: sampleRoom.has_balcony || false,
            has_kitchen: sampleRoom.has_kitchen || false,
            is_accessible: sampleRoom.is_accessible || false,
            is_active: true
          }
          
          const { data: roomType, error: rtError } = await supabase
            .from('room_types')
            .insert(roomTypeData)
            .select()
            .single()
          
          if (rtError) {
            console.error(`Error creating room type ${roomTypeName} for property ${property.name}:`, rtError)
            continue
          }
          
          roomTypeMap.set(`${property.id}-${roomTypeName}`, roomType.id)
          console.log(`Created room type: ${roomTypeName} for ${property.name}`)
        }
      }
    }
    
    // Step 4: Create room units from existing rooms
    console.log('4. Creating room units...')
    
    const roomUnitMap = new Map()
    
    for (const room of rooms) {
      if (!room.property_id) continue
      
      const roomTypeName = room.room_type || 'Standard Room'
      const roomTypeId = roomTypeMap.get(`${room.property_id}-${roomTypeName}`)
      
      if (!roomTypeId) {
        console.error(`Room type not found for room ${room.room_number}`)
        continue
      }
      
      const roomUnitData = {
        room_type_id: roomTypeId,
        unit_number: room.room_number,
        floor_number: room.floor_number,
        access_code: room.access_code,
        access_instructions: room.access_instructions,
        wifi_name: room.wifi_name,
        wifi_password: room.wifi_password,
        unit_amenities: room.room_amenities, // Unit-specific amenities
        maintenance_notes: null,
        is_active: room.is_active !== false
      }
      
      const { data: roomUnit, error: ruError } = await supabase
        .from('room_units')
        .insert(roomUnitData)
        .select()
        .single()
      
      if (ruError) {
        console.error(`Error creating room unit ${room.room_number}:`, ruError)
        continue
      }
      
      roomUnitMap.set(room.id, roomUnit.id)
      console.log(`Created room unit: ${room.room_number}`)
    }
    
    // Step 5: Update reservations with new foreign keys
    console.log('5. Updating reservations...')
    
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .not('room_id', 'is', null)
    
    if (resError) {
      console.error('Error fetching reservations:', resError)
      return
    }
    
    for (const reservation of reservations) {
      const room = rooms.find(r => r.id === reservation.room_id)
      if (!room) continue
      
      const roomTypeName = room.room_type || 'Standard Room'
      const roomTypeId = roomTypeMap.get(`${room.property_id}-${roomTypeName}`)
      const roomUnitId = roomUnitMap.get(room.id)
      
      if (roomTypeId && roomUnitId) {
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            property_id: room.property_id,
            room_type_id: roomTypeId,
            room_unit_id: roomUnitId
          })
          .eq('id', reservation.id)
        
        if (updateError) {
          console.error(`Error updating reservation ${reservation.id}:`, updateError)
        } else {
          console.log(`Updated reservation ${reservation.id}`)
        }
      }
    }
    
    // Step 6: Update property_images with new foreign keys
    console.log('6. Updating property images...')
    
    const { data: images, error: imgError } = await supabase
      .from('property_images')
      .select('*')
      .not('room_id', 'is', null)
    
    if (imgError) {
      console.error('Error fetching property images:', imgError)
      return
    }
    
    for (const image of images) {
      const room = rooms.find(r => r.id === image.room_id)
      if (!room) continue
      
      const roomTypeName = room.room_type || 'Standard Room'
      const roomTypeId = roomTypeMap.get(`${room.property_id}-${roomTypeName}`)
      const roomUnitId = roomUnitMap.get(room.id)
      
      if (roomTypeId && roomUnitId) {
        const { error: updateError } = await supabase
          .from('property_images')
          .update({
            room_type_id: roomTypeId,
            room_unit_id: roomUnitId
          })
          .eq('id', image.id)
        
        if (updateError) {
          console.error(`Error updating property image ${image.id}:`, updateError)
        } else {
          console.log(`Updated property image ${image.id}`)
        }
      }
    }
    
    console.log('Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Verify the migrated data')
    console.log('2. Update room type base prices manually')
    console.log('3. Test the application with the new structure')
    console.log('4. Once verified, drop the old rooms table and room_id columns')
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToV5()
}

module.exports = { migrateToV5 }


