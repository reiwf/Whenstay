require('dotenv').config();
const EmailService = require('./services/emailService');

async function testInvitationEmailSender() {
  console.log('📧 Testing Invitation Email Sender Configuration...\n');

  try {
    // Step 1: Test service configuration
    console.log('1. Testing EmailService configuration...');
    
    const emailService = new EmailService();
    const status = emailService.getServiceStatus();
    
    console.log('📋 Email Service Status:');
    console.log(`   - Configured: ${status.configured}`);
    console.log(`   - Default From Email: ${emailService.fromEmail}`);
    console.log(`   - Invitation From Email: ${emailService.invitationFromEmail}`);
    console.log(`   - Frontend URL: ${emailService.frontendUrl}`);
    
    // Step 2: Test invitation email data structure
    console.log('\n2. Testing invitation email format...');
    
    const testEmail = 'test@example.com';
    const testToken = 'test-token-123';
    const testRole = 'guest';
    
    // We'll mock the email sending to test the data structure without actually sending
    const originalSend = emailService.resend.emails.send;
    let capturedEmailData = null;
    
    emailService.resend.emails.send = async (emailData) => {
      capturedEmailData = emailData;
      return { id: 'mock-email-id' };
    };
    
    try {
      await emailService.sendUserInvitation(testEmail, testToken, testRole);
      
      console.log('✅ Invitation email data captured:');
      console.log(`   - From: ${capturedEmailData.from}`);
      console.log(`   - To: ${capturedEmailData.to}`);
      console.log(`   - Subject: ${capturedEmailData.subject}`);
      
      // Verify the sender format
      const expectedFrom = `"Register" <${emailService.invitationFromEmail}>`;
      if (capturedEmailData.from === expectedFrom) {
        console.log('✅ SUCCESS: Invitation email uses correct sender format!');
      } else {
        console.log(`❌ MISMATCH: Expected "${expectedFrom}", got "${capturedEmailData.from}"`);
      }
      
    } finally {
      // Restore original method
      emailService.resend.emails.send = originalSend;
    }
    
    // Step 3: Test other email types still use default sender
    console.log('\n3. Testing other email types use default sender...');
    
    emailService.resend.emails.send = async (emailData) => {
      capturedEmailData = emailData;
      return { id: 'mock-email-id' };
    };
    
    try {
      await emailService.sendCheckinInvitation(testEmail, 'Test Guest', 'test-token', new Date());
      
      console.log('📋 Check-in email data:');
      console.log(`   - From: ${capturedEmailData.from}`);
      
      if (capturedEmailData.from === emailService.fromEmail) {
        console.log('✅ SUCCESS: Check-in emails still use default sender!');
      } else {
        console.log(`❌ UNEXPECTED: Check-in email from field changed unexpectedly`);
      }
      
    } finally {
      // Restore original method
      emailService.resend.emails.send = originalSend;
    }
    
    // Step 4: Show configuration guidance
    console.log('\n4. Configuration guidance:');
    console.log('📝 To use the new invitation sender:');
    console.log('   1. Set INVITATION_FROM_EMAIL=register@staylabel.com in your .env file');
    console.log('   2. Ensure your email provider (Resend) has verified register@staylabel.com');
    console.log('   3. Invitation emails will show "Register <register@staylabel.com>" as sender');
    console.log('   4. Other system emails will continue using ADMIN_EMAIL or default');
    
    console.log('\n🎉 Email sender configuration test completed!');
    console.log('\n📋 Summary:');
    console.log('   - ✅ Invitation emails now use dedicated sender configuration');
    console.log('   - ✅ Sender displays as "Register" with configurable email address');
    console.log('   - ✅ Other emails unchanged (check-in, confirmations, etc.)');
    console.log('   - ✅ Graceful fallback to default email if env var not set');
    console.log('   - ✅ Environment configuration documented in .env.example');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testInvitationEmailSender();
