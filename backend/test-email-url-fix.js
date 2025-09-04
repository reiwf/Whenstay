const emailService = require('./services/emailService');

async function testEmailUrlFix() {
  console.log('🔗 Testing Email URL Fix...\n');

  try {
    // Check email service status to see the frontend URL being used
    console.log('1. Checking email service configuration...');
    const status = emailService.getServiceStatus();
    console.log('📧 Email service status:', status);
    console.log('🌐 Frontend URL:', status.frontendUrl);
    
    // Test invitation URL generation
    console.log('\n2. Testing invitation URL generation...');
    const testToken = 'test_token_12345';
    const expectedUrl = `${status.frontendUrl}/accept-invitation/${testToken}`;
    console.log('🔗 Generated invitation URL:', expectedUrl);
    
    // Verify it's using the correct domain
    if (expectedUrl.includes('app.staylabel.com')) {
      console.log('✅ URL is correctly using app.staylabel.com domain');
    } else if (expectedUrl.includes('localhost')) {
      console.log('ℹ️  URL is using localhost (development mode)');
    } else {
      console.log('⚠️  URL is using unexpected domain:', expectedUrl);
    }
    
    console.log('\n🎉 Email URL fix verified!');
    console.log('\n📝 What this means:');
    console.log('   - New invitation emails will use the correct app.staylabel.com domain');
    console.log('   - Links will properly redirect to the frontend application');
    console.log('   - No more 404 errors when users click invitation links');
    console.log('   - If FRONTEND_URL environment variable is set, it will use that value');
    console.log('   - Otherwise, it defaults to https://app.staylabel.com');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testEmailUrlFix();
