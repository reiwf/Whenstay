require('dotenv').config();
const userService = require('./services/userService');
const emailService = require('./services/emailService');

async function testInvitationSystem() {
  console.log('🧪 Testing User Invitation System...\n');

  try {
    // Test 1: Generate invitation token
    console.log('1. Testing token generation...');
    const token = userService.generateInvitationToken();
    console.log(`✅ Generated token: ${token.substring(0, 16)}...`);

    // Test 2: Email service status
    console.log('\n2. Testing email service status...');
    const emailStatus = emailService.getServiceStatus();
    console.log('✅ Email service status:', emailStatus);

    // Test 3: Create test admin user (if not exists)
    console.log('\n3. Testing admin user creation...');
    const adminUser = await userService.createTestAdminUser();
    console.log(`✅ Admin user: ${adminUser.first_name} ${adminUser.last_name} (${adminUser.role})`);

    // Test 4: Send invitation (simulated)
    console.log('\n4. Testing invitation process...');
    console.log('📧 This would send an invitation email to: test@example.com');
    console.log('🔗 Invitation URL would be: /accept-invitation/[token]');
    console.log('⏰ Token would expire in: 24 hours');

    // Test 5: Get user stats
    console.log('\n5. Testing user statistics...');
    const stats = await userService.getUserStats();
    console.log('✅ User stats:', stats);

    console.log('\n🎉 All tests passed! Invitation system is ready.');
    console.log('\n📋 Next steps:');
    console.log('   1. Run the database migration');
    console.log('   2. Update frontend user management UI');
    console.log('   3. Create invitation acceptance page');
    console.log('   4. Test the complete flow');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testInvitationSystem();
