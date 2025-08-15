/**
 * Initialize Beds24 Token System
 * This script sets up the initial access token using the refresh token
 */

// Load environment variables
require('dotenv').config();

const beds24Service = require('../services/beds24Service');
const { supabaseAdmin } = require('../config/supabase');

async function initializeBeds24Tokens() {
  try {
    console.log('🔧 Initializing Beds24 token system...');

    // Step 1: Check if auth table exists and create if needed
    console.log('\n1. Setting up authentication table...');
    
    try {
      const { error: tableError } = await supabaseAdmin.rpc('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.beds24_auth (
              id SERIAL PRIMARY KEY,
              access_token TEXT,
              refresh_token TEXT NOT NULL,
              expires_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `
      });

      if (tableError) {
        console.log('Table might already exist, continuing...');
      }
    } catch (tableSetupError) {
      console.log('Table setup completed or already exists');
    }

    // Step 2: Check if we have tokens in environment
    const envRefreshToken = process.env.BEDS24_REFRESH_TOKEN;
    const envAccessToken = process.env.BEDS24_TOKEN; // Check for existing access token
    
    if (!envRefreshToken) {
      console.log('❌ No BEDS24_REFRESH_TOKEN found in environment variables');
      console.log('💡 Please set BEDS24_REFRESH_TOKEN in your .env file');
      return;
    }

    // Step 3: Store tokens in database
    console.log('\n2. Storing tokens in database...');
    
    let initialData = {
      id: 1,
      refresh_token: envRefreshToken,
      updated_at: new Date().toISOString()
    };

    // If we have an existing access token, use it and set expiry to 24 hours from now
    if (envAccessToken) {
      console.log('✅ Found existing access token in environment');
      initialData.access_token = envAccessToken;
      initialData.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    } else {
      console.log('⚠️  No access token found, will need to refresh');
      initialData.access_token = null;
      initialData.expires_at = new Date(); // Set to past date to force refresh
    }
    
    const { error: insertError } = await supabaseAdmin
      .from('beds24_auth')
      .upsert(initialData);

    if (insertError) {
      console.error('❌ Failed to store tokens:', insertError);
      return;
    }

    console.log('✅ Tokens stored in database');

    // Step 4: Get valid access token (will refresh if needed)
    console.log('\n3. Getting/validating access token...');
    
    try {
      const accessToken = await beds24Service.getValidAccessToken();
      console.log('✅ Valid access token obtained');
      console.log('   Token length:', accessToken.length);
      
      // Step 5: Test the token by making a simple API call
      console.log('\n4. Testing access token with API call...');
      
      try {
        const testBookings = await beds24Service.getBookings({ 
          limit: 1,
          checkIn: '2025-08-01',
          checkOut: '2025-08-31'
        });
        console.log('✅ Access token is working - API test successful');
        console.log(`   Retrieved ${testBookings.length || 0} bookings in test call`);
        
        if (testBookings.length > 0) {
          console.log('   Sample booking ID:', testBookings[0].id);
        }
      } catch (testError) {
        console.log('⚠️  API test failed:', testError.message);
        console.log('   Token was stored but API call failed');
        
        // Check if it's an authentication error
        if (testError.message.includes('401') || testError.message.includes('403')) {
          console.log('   This appears to be an authentication issue');
          console.log('   The refresh token might be expired or invalid');
        }
      }

    } catch (tokenError) {
      console.error('❌ Failed to get/validate access token:', tokenError.message);
      
      if (tokenError.message.includes('500')) {
        console.log('💡 The refresh token might be expired (30-day validity)');
        console.log('💡 You may need to generate a new refresh token from the Beds24 dashboard');
      }
      
      return;
    }

    // Step 6: Verify database state
    console.log('\n5. Verifying final state...');
    
    const { data: finalAuth } = await supabaseAdmin
      .from('beds24_auth')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (finalAuth) {
      console.log('✅ Authentication data verified:', {
        hasAccessToken: !!finalAuth.access_token,
        hasRefreshToken: !!finalAuth.refresh_token,
        expiresAt: finalAuth.expires_at,
        createdAt: finalAuth.created_at
      });
    }

    console.log('\n🎉 Beds24 token system initialization complete!');
    console.log('\n📋 Next Steps:');
    console.log('   1. The scheduled refresh job will automatically refresh tokens every 20 hours');
    console.log('   2. All Beds24 API calls will now use proper access tokens');
    console.log('   3. Failed authentication will trigger automatic token refresh');
    console.log('   4. Test your Airbnb message sending functionality');

  } catch (error) {
    console.error('❌ Token initialization failed:', error);
  }
}

// Run the initialization
if (require.main === module) {
  initializeBeds24Tokens()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Initialization script error:', error);
      process.exit(1);
    });
}

module.exports = { initializeBeds24Tokens };
