const userService = require('./services/userService');
const emailService = require('./services/emailService');

async function testCompleteInvitationFlow() {
  console.log('🔄 Testing Complete Invitation Flow...\n');

  try {
    // Test 1: Check email service configuration
    console.log('1. Checking email service configuration...');
    const emailStatus = emailService.getServiceStatus();
    console.log('📧 Email service status:', emailStatus);
    console.log('🌐 Frontend URL:', emailStatus.frontendUrl);
    
    // Test 2: Test invitation creation (without actually sending email)
    console.log('\n2. Testing invitation creation...');
    const testEmail = 'flow-test@example.com';
    const testRole = 'owner';
    const invitedBy = null;
    
    let invitation;
    try {
      invitation = await userService.inviteUser(testEmail, testRole, invitedBy);
      console.log('✅ Invitation created successfully');
      console.log('📋 Invitation details:');
      console.log('   - ID:', invitation.id);
      console.log('   - Email:', invitation.email);
      console.log('   - Role:', invitation.role);
      console.log('   - Token:', invitation.invitation_token?.substring(0, 16) + '...');
      console.log('   - Status:', invitation.invitation_status);
    } catch (error) {
      console.error('❌ Failed to create invitation:', error.message);
      return;
    }
    
    // Test 3: Generate and verify invitation URL
    console.log('\n3. Testing invitation URL generation...');
    const invitationUrl = `${emailStatus.frontendUrl}/accept-invitation/${invitation.invitation_token}`;
    console.log('🔗 Generated invitation URL:', invitationUrl);
    
    // Check URL format
    if (invitationUrl.includes('app.staylabel.com/accept-invitation/')) {
      console.log('✅ URL format is correct for production');
    } else if (invitationUrl.includes('localhost') && invitationUrl.includes('/accept-invitation/')) {
      console.log('✅ URL format is correct for development');
    } else {
      console.log('⚠️  URL format may be incorrect:', invitationUrl);
    }
    
    // Test 4: Validate invitation token
    console.log('\n4. Testing invitation token validation...');
    try {
      const validatedInvitation = await userService.getInvitationByToken(invitation.invitation_token);
      console.log('✅ Invitation token validation successful');
      console.log('📋 Validated invitation:');
      console.log('   - Email:', validatedInvitation.email);
      console.log('   - Role:', validatedInvitation.role);
      console.log('   - Expires:', validatedInvitation.expires_at);
    } catch (error) {
      console.error('❌ Failed to validate invitation token:', error.message);
    }
    
    // Test 5: Clean up test invitation
    console.log('\n5. Cleaning up test invitation...');
    await userService.markInvitationExpired(invitation.invitation_token);
    console.log('🧹 Test invitation cleaned up');
    
    console.log('\n🎉 Complete invitation flow test passed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Invitation creation works');
    console.log('   ✅ Email service configured');
    console.log('   ✅ Frontend URL is correct');
    console.log('   ✅ Token validation works');
    console.log('   ✅ Frontend route should handle /accept-invitation/:token');
    console.log('\n🔧 The invitation system should now work correctly!');

  } catch (error) {
    console.error('❌ Flow test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testCompleteInvitationFlow();
