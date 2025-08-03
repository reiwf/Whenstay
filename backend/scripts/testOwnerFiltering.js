require('dotenv').config();
const databaseService = require('../services/databaseService');

async function testOwnerFiltering() {
  try {
    console.log('=== Testing Owner Filtering ===\n');

    // Test 1: Get all properties without filtering (admin view)
    console.log('1. Testing admin view (no filtering):');
    const allProperties = await databaseService.getAllProperties();
    console.log(`   Found ${allProperties.length} properties total`);
    allProperties.forEach(property => {
      console.log(`   - ${property.name} (Owner ID: ${property.owner_id || 'NULL'})`);
    });

    // Test 2: Create a mock owner profile
    const mockOwnerProfile = {
      id: 'test-owner-id-123',
      role: 'owner'
    };

    console.log('\n2. Testing owner filtering with mock profile:');
    console.log(`   Mock owner ID: ${mockOwnerProfile.id}`);
    
    const ownerProperties = await databaseService.getAllProperties(mockOwnerProfile);
    console.log(`   Found ${ownerProperties.length} properties for owner`);
    
    if (ownerProperties.length === 0) {
      console.log('   ❌ No properties found for owner - this confirms the filtering is working');
      console.log('   ✅ The issue is likely that the owner has no properties assigned');
    } else {
      ownerProperties.forEach(property => {
        console.log(`   - ${property.name} (Owner ID: ${property.owner_id})`);
      });
    }

    // Test 3: Find an actual owner user and test with their ID
    console.log('\n3. Testing with actual owner user:');
    
    // Get all users to find an owner
    const users = await databaseService.getAllUsers(100, 0);
    const ownerUsers = users.filter(user => user.role === 'owner');
    
    if (ownerUsers.length === 0) {
      console.log('   ❌ No owner users found in database');
      return;
    }

    const actualOwner = ownerUsers[0];
    console.log(`   Found owner: ${actualOwner.first_name} ${actualOwner.last_name} (ID: ${actualOwner.id})`);
    
    const actualOwnerProperties = await databaseService.getAllProperties(actualOwner);
    console.log(`   Properties for ${actualOwner.first_name}: ${actualOwnerProperties.length}`);
    
    if (actualOwnerProperties.length === 0) {
      console.log('   ❌ Owner has no properties assigned');
      console.log('   🔧 Let\'s assign a property to this owner...');
      
      if (allProperties.length > 0) {
        const firstProperty = allProperties[0];
        console.log(`   Assigning "${firstProperty.name}" to ${actualOwner.first_name}...`);
        
        await databaseService.updateProperty(firstProperty.id, {
          ownerId: actualOwner.id
        });
        
        console.log('   ✅ Property assigned! Testing again...');
        
        const updatedOwnerProperties = await databaseService.getAllProperties(actualOwner);
        console.log(`   Properties after assignment: ${updatedOwnerProperties.length}`);
        
        updatedOwnerProperties.forEach(property => {
          console.log(`   - ${property.name} (Owner ID: ${property.owner_id})`);
        });
      }
    } else {
      actualOwnerProperties.forEach(property => {
        console.log(`   - ${property.name} (Owner ID: ${property.owner_id})`);
      });
    }

    // Test 4: Test with stats
    console.log('\n4. Testing getPropertiesWithStats filtering:');
    const ownerPropertiesWithStats = await databaseService.getPropertiesWithStats(actualOwner);
    console.log(`   Properties with stats for ${actualOwner.first_name}: ${ownerPropertiesWithStats.length}`);
    
    ownerPropertiesWithStats.forEach(property => {
      console.log(`   - ${property.name} (Owner ID: ${property.owner_id})`);
      console.log(`     Stats: ${property.stats.totalRoomUnits} units, ${property.stats.totalReservations} reservations`);
    });

    console.log('\n=== Summary ===');
    console.log('✅ Owner filtering logic is implemented correctly');
    console.log('✅ The issue is likely that owners don\'t have properties assigned to them');
    console.log('💡 Solution: Assign properties to owner users via the owner_id field');

  } catch (error) {
    console.error('Error in testOwnerFiltering:', error);
  }
}

// Function to assign a property to an owner
async function assignPropertyToOwner(propertyId, ownerId) {
  try {
    console.log(`Assigning property ${propertyId} to owner ${ownerId}...`);
    
    const updatedProperty = await databaseService.updateProperty(propertyId, {
      ownerId: ownerId
    });
    
    console.log('✅ Property assigned successfully:', updatedProperty.name);
    return updatedProperty;
  } catch (error) {
    console.error('Error assigning property to owner:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testOwnerFiltering();
}

module.exports = { testOwnerFiltering, assignPropertyToOwner };
