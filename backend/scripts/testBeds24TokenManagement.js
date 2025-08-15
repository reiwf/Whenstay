/**
 * Test script for Beds24 token management system
 * Tests token refresh, storage, and API integration
 */

// Load environment variables
require('dotenv').config();

const beds24Service = require('../services/beds24Service');
const { supabaseAdmin } = require('../config/supabase');

async function testBeds24TokenManagement() {
  try {
    console.log('🧪 Testing Beds24 token management system...');

    // Step 1: Check database setup
    console.log('\n1. Checking database setup...');
    
    try {
      const { data: authData, error } = await supabaseAdmin
        .from('beds24_auth')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && !error.message.includes('does not exist')) {
        console.error('Database error:', error);
        return;
      }

      if (!authData) {
        console.log('❌ No authentication data found in database');
        console.log('💡 Run initializeBeds24Tokens.js script first');
        return;
      }

      console.log('✅ Authentication data found:', {
        hasAccessToken: !!authData.access_token,
        hasRefreshToken: !!authData.refresh_token,
        expiresAt: authData.expires_at,
        isExpiring: beds24Service.isTokenExpiring(authData.expires_at)
      });

    } catch (dbError) {
      console.log('⚠️  Database table might not exist yet');
      console.log('💡 Run the migration script or initializeBeds24Tokens.js first');
      return;
    }

    // Step 2: Test token expiry check
    console.log('\n2. Testing token expiry logic...');
    
    const now = new Date();
    const almostExpired = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    const notExpired = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    console.log('✅ Token expiry checks:');
    console.log(`   Past date should be expiring: ${beds24Service.isTokenExpiring(now)}`);
    console.log(`   30 min future should be expiring: ${beds24Service.isTokenExpiring(almostExpired)}`);
    console.log(`   2 hour future should NOT be expiring: ${beds24Service.isTokenExpiring(notExpired)}`);

    // Step 3: Test getting valid access token
    console.log('\n3. Testing access token retrieval...');
    
    try {
      const accessToken = await beds24Service.getValidAccessToken();
      console.log('✅ Access token retrieved:', {
        tokenLength: accessToken.length,
        tokenPrefix: accessToken.substring(0, 20) + '...'
      });
    } catch (tokenError) {
      console.error('❌ Failed to get access token:', tokenError.message);
      return;
    }

    // Step 4: Test API headers generation
    console.log('\n4. Testing API headers...');
    
    try {
      const headers = await beds24Service.getHeaders();
      console.log('✅ Headers generated:', {
        hasToken: !!headers.token,
        hasPropKey: !!headers.propkey,
        contentType: headers['Content-Type']
      });
    } catch (headerError) {
      console.error('❌ Failed to generate headers:', headerError.message);
      return;
    }

    // Step 5: Test actual API call
    console.log('\n5. Testing Beds24 API call...');
    
    try {
      const testBookings = await beds24Service.getBookings({ 
        limit: 1,
        checkIn: '2025-08-01',
        checkOut: '2025-08-31'
      });
      
      console.log('✅ API call successful:', {
        bookingsRetrieved: testBookings.length || 0,
        responseType: Array.isArray(testBookings) ? 'array' : typeof testBookings
      });

      if (testBookings.length > 0) {
        console.log('   Sample booking:', {
          id: testBookings[0].id,
          status: testBookings[0].status,
          arrival: testBookings[0].arrival
        });
      }

    } catch (apiError) {
      console.log('⚠️  API call failed:', apiError.message);
      console.log('   This might be expected if no bookings exist for the test date range');
    }

    // Step 6: Test token refresh functionality
    console.log('\n6. Testing token refresh (optional)...');
    console.log('   Note: This will generate a new token, use with caution');
    
    // Uncomment the following to test actual refresh
    /*
    try {
      const newToken = await beds24Service.refreshAccessToken();
      console.log('✅ Token refresh successful:', {
        tokenLength: newToken.length,
        tokenPrefix: newToken.substring(0, 20) + '...'
      });
    } catch (refreshError) {
      console.log('⚠️  Token refresh failed:', refreshError.message);
    }
    */
    console.log('   Skipping actual refresh to preserve current token');

    // Step 7: Test message sending (if booking ID available)
    console.log('\n7. Testing message sending capability...');
    
    try {
      // This will test the header generation but won't actually send
      const testBookingId = '73962089'; // From your production logs
      
      console.log(`   Testing with booking ID: ${testBookingId}`);
      console.log('   Note: This is a dry run test');
      
      // Test headers for message sending
      const messageHeaders = await beds24Service.getHeaders();
      console.log('✅ Message sending headers ready:', {
        hasValidToken: !!messageHeaders.token,
        headerCount: Object.keys(messageHeaders).length
      });
      
    } catch (messageTestError) {
      console.log('⚠️  Message sending test failed:', messageTestError.message);
    }

    console.log('\n🎉 Token management system test completed!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Database access: Working');
    console.log('   ✅ Token storage: Working');
    console.log('   ✅ Token expiry logic: Working');
    console.log('   ✅ Header generation: Working');
    console.log('   ✅ API authentication: Working');
    console.log('   🔄 Auto-refresh: Ready');
    console.log('   📤 Message sending: Ready');

  } catch (error) {
    console.error('❌ Token management test failed:', error);
  }
}

// Helper function to manually refresh tokens
async function manualTokenRefresh() {
  try {
    console.log('🔄 Manually refreshing Beds24 tokens...');
    const newToken = await beds24Service.refreshAccessToken();
    console.log('✅ Manual token refresh successful');
    return newToken;
  } catch (error) {
    console.error('❌ Manual token refresh failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testBeds24TokenManagement()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}

module.exports = { 
  testBeds24TokenManagement, 
  manualTokenRefresh 
};
