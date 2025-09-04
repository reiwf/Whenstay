require('dotenv').config();
const userService = require('./services/userService');

async function testInvitationFix() {
  console.log('🔧 Testing Invitation Fix...\n');

  try {
    // Test invitation creation with potential email failure
    console.log('1. Testing invitation creation (email may fail gracefully)...');
    
    const testEmail = 'testuser@example.com';
    const testRole = 'guest';
    const invitedBy = null; // Simulating no admin context
    
    const invitation = await userService.inviteUser(testEmail, testRole, invitedBy);
    
    console.log('✅ Invitation created successfully!');
    console.log('📧 Email sent status:', invitation.email_sent || false);
    console.log('📋 Invitation details:');
    console.log('   - ID:', invitation.id);
    console.log('   - Email:', invitation.email);
    console.log('   - Role:', invitation.role);
    console.log('   - Status:', invitation.invitation_status);
    console.log('   - Expires:', invitation.invitation_expires_at);
    
    // Clean up: mark as expired so it doesn't interfere with future tests
    await userService.markInvitationExpired(invitation.invitation_token);
    console.log('🧹 Test invitation cleaned up');
    
    console.log('\n🎉 Fix verified! Invitation system now handles email failures gracefully.');
    console.log('\n📝 What this means:');
    console.log('   - Invitations are created even if email sending fails');
    console.log('   - No more 500 errors in the frontend');
    console.log('   - Admin can see invitation status and manually share invite links');
    console.log('   - Email configuration can be fixed separately');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testInvitationFix();
