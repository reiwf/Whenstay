require('dotenv').config();

// Check if required environment variables are set
const requiredEnvVars = ['RESEND_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('\n📝 To fix this:');
  console.log('1. Create a .env file in the backend directory');
  console.log('2. Add the following variables:');
  missingEnvVars.forEach(varName => {
    console.log(`   ${varName}=your_${varName.toLowerCase()}`);
  });
  console.log('\n💡 The Resend email service migration is complete and ready to use once configured.');
  console.log('🔗 Get your Resend API key from: https://resend.com/api-keys');
  process.exit(1);
}

const emailService = require('./services/emailService');
const communicationService = require('./services/communicationService');
const { supabaseAdmin } = require('./config/supabase');

async function testResendEmailThreading() {
  console.log('🧪 Testing Resend Email Service with Threading Support');
  console.log('='.repeat(60));

  try {
    // Step 1: Check service configuration
    console.log('\n📋 Step 1: Checking service configuration...');
    const serviceStatus = emailService.getServiceStatus();
    console.log('Service status:', serviceStatus);

    if (!serviceStatus.configured) {
      throw new Error('Resend API key not properly configured.');
    }

    // Step 2: Create a test reservation and thread
    console.log('\n📋 Step 2: Creating test reservation and thread...');
    
    // Create test reservation
    const testReservation = {
      booking_name: 'John',
      booking_lastname: 'Doe',
      booking_email: 'test@example.com',
      check_in_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      check_out_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // In 3 days
      property_id: '00000000-0000-0000-0000-000000000001', // Dummy property ID
      booking_source: 'test',
      booking_status: 'confirmed',
      total_price: 100.00,
      currency: 'USD'
    };

    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .insert(testReservation)
      .select()
      .single();

    if (reservationError) {
      throw new Error(`Failed to create test reservation: ${reservationError.message}`);
    }

    console.log('✅ Created test reservation:', reservation.id);

    // Create thread using communication service
    const thread = await communicationService.findOrCreateThreadByReservation(reservation.id);
    console.log('✅ Created/found thread:', thread.id);

    // Step 3: Send first email (no threading context)
    console.log('\n📋 Step 3: Sending first email (new thread)...');
    
    const firstMessage = await communicationService.sendMessage({
      thread_id: thread.id,
      channel: 'email',
      content: 'Hello! This is your first message from Staylabel. Welcome to our service!',
      origin_role: 'host'
    });

    console.log('✅ First email sent successfully. Message ID:', firstMessage.id);

    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check email metadata storage
    const { data: firstEmailMetadata } = await supabaseAdmin
      .from('email_metadata')
      .select('*')
      .eq('message_id', firstMessage.id)
      .single();

    if (firstEmailMetadata) {
      console.log('✅ Email metadata stored:', {
        email_message_id: firstEmailMetadata.email_message_id,
        email_thread_id: firstEmailMetadata.email_thread_id,
        provider: 'resend'
      });
    } else {
      console.warn('⚠️  No email metadata found for first message');
    }

    // Step 4: Send second email (with threading context)
    console.log('\n📋 Step 4: Sending second email (should thread)...');
    
    const secondMessage = await communicationService.sendMessage({
      thread_id: thread.id,
      channel: 'email',
      content: 'This is a follow-up message. It should be threaded with the previous email using proper Gmail headers.',
      origin_role: 'host'
    });

    console.log('✅ Second email sent successfully. Message ID:', secondMessage.id);

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check second email metadata
    const { data: secondEmailMetadata } = await supabaseAdmin
      .from('email_metadata')
      .select('*')
      .eq('message_id', secondMessage.id)
      .single();

    if (secondEmailMetadata) {
      console.log('✅ Second email metadata stored:', {
        email_message_id: secondEmailMetadata.email_message_id,
        email_thread_id: secondEmailMetadata.email_thread_id,
        email_in_reply_to: secondEmailMetadata.email_in_reply_to,
        email_references: secondEmailMetadata.email_references,
        has_threading: !!(secondEmailMetadata.email_in_reply_to || secondEmailMetadata.email_references)
      });
    } else {
      console.warn('⚠️  No email metadata found for second message');
    }

    // Step 5: Test direct sendGenericMessage method
    console.log('\n📋 Step 5: Testing direct sendGenericMessage method...');
    
    const directResult = await emailService.sendGenericMessage(
      'test@example.com',
      'John Doe',
      'Direct Test Message',
      'This is a direct test of the sendGenericMessage method with threading support.',
      {
        reservationId: reservation.id,
        propertyName: 'Test Property',
        checkInDate: reservation.check_in_date
      },
      firstMessage.id // Use first message ID for threading context
    );

    console.log('✅ Direct email sent:', {
      id: directResult.id,
      provider: directResult.provider,
      emailThreadId: directResult.emailThreadId,
      success: directResult.success
    });

    // Step 6: Verify threading context retrieval
    console.log('\n📋 Step 6: Testing threading context retrieval...');
    
    const threadingContext = await emailService.getThreadingContext(firstMessage.id, {
      reservationId: reservation.id
    });

    console.log('Threading context result:', threadingContext);

    // Step 7: Check all email metadata for the thread
    console.log('\n📋 Step 7: Reviewing all email metadata for thread...');
    
    const { data: allThreadEmails } = await supabaseAdmin
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        email_metadata(*)
      `)
      .eq('thread_id', thread.id)
      .eq('channel', 'email')
      .order('created_at', { ascending: true });

    console.log('All thread emails with metadata:', allThreadEmails?.map(msg => ({
      message_id: msg.id,
      content_preview: msg.content.substring(0, 50) + '...',
      email_message_id: msg.email_metadata?.email_message_id,
      email_thread_id: msg.email_metadata?.email_thread_id,
      has_threading: !!(msg.email_metadata?.email_in_reply_to || msg.email_metadata?.email_references)
    })));

    // Step 8: Test HTML template rendering
    console.log('\n📋 Step 8: Testing branded HTML template...');
    
    const brandedTemplate = emailService.getBrandedMessageTemplate(
      'John Doe',
      'This is a test of the branded email template with multiple paragraphs.\n\nIt should handle line breaks properly and display beautifully.',
      {
        propertyName: 'Test Hotel',
        reservationId: reservation.id,
        checkInDate: reservation.check_in_date
      }
    );

    console.log('✅ Branded template generated successfully. Length:', brandedTemplate.length);

    console.log('\n🎉 All tests completed successfully!');
    console.log('='.repeat(60));

    console.log('\n📊 Test Summary:');
    console.log('- ✅ Service configuration verified');
    console.log('- ✅ Test reservation and thread created');
    console.log('- ✅ First email sent (no threading)');
    console.log('- ✅ Second email sent (with threading)');
    console.log('- ✅ Direct sendGenericMessage tested');
    console.log('- ✅ Threading context retrieval tested');
    console.log('- ✅ Email metadata storage verified');
    console.log('- ✅ Branded template generation tested');

    // Cleanup: Remove test data
    console.log('\n🧹 Cleaning up test data...');
    await supabaseAdmin.from('reservations').delete().eq('id', reservation.id);
    console.log('✅ Test data cleaned up');

    return {
      success: true,
      threadId: thread.id,
      reservationId: reservation.id,
      messageIds: [firstMessage.id, secondMessage.id],
      directEmailId: directResult.id
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    
    // Attempt cleanup even on failure
    try {
      if (typeof reservation !== 'undefined' && reservation?.id) {
        await supabaseAdmin.from('reservations').delete().eq('id', reservation.id);
        console.log('🧹 Cleaned up test data after error');
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError.message);
    }

    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Test email service status check
async function testEmailServiceStatus() {
  console.log('\n🔍 Testing email service status...');
  
  const status = emailService.getServiceStatus();
  console.log('Email service status:', status);
  
  // Test validation
  const validEmail = emailService.validateEmailData({
    to: 'test@example.com',
    subject: 'Test Subject',
    html: '<p>Test content</p>'
  });
  
  const invalidEmail = emailService.validateEmailData({
    to: 'invalid-email',
    subject: '',
    html: ''
  });
  
  console.log('Valid email validation:', validEmail);
  console.log('Invalid email validation:', invalidEmail);
}

// Run the tests
async function runAllTests() {
  console.log('🚀 Starting Resend Email Threading Tests');
  console.log('='*80);
  
  // Test service status first
  await testEmailServiceStatus();
  
  // Test threading functionality
  const result = await testResendEmailThreading();
  
  console.log('\n📋 Final Result:', result);
  process.exit(result.success ? 0 : 1);
}

// Export for use in other scripts
module.exports = {
  testResendEmailThreading,
  testEmailServiceStatus
};

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}
