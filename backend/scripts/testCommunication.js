const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCommunication() {
  console.log('🧪 Testing Communication Feature...');

  try {
    // First, let's check if our tables exist
    console.log('\n📋 Checking communication tables...');
    
    const { data: threads, error: threadsError } = await supabase
      .from('message_threads')
      .select('*')
      .limit(1);
    
    if (threadsError) {
      console.error('❌ message_threads table not found:', threadsError.message);
      return;
    }
    
    console.log('✅ message_threads table exists');

    // Check messages table
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (messagesError) {
      console.error('❌ messages table not found:', messagesError.message);
      return;
    }
    
    console.log('✅ messages table exists');

    // Create a sample thread
    console.log('\n📝 Creating sample thread...');
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .insert({
        subject: 'Welcome to Tokyo Apartment',
        status: 'open',
        last_message_at: new Date().toISOString(),
        last_message_preview: 'Hello! Welcome to your stay...'
      })
      .select()
      .single();

    if (threadError) {
      console.error('❌ Failed to create thread:', threadError.message);
      return;
    }

    console.log('✅ Created sample thread:', thread.id);

    // Create sample messages
    console.log('\n💬 Creating sample messages...');
    
    const sampleMessages = [
      {
        thread_id: thread.id,
        origin_role: 'guest',
        direction: 'incoming',
        channel: 'whatsapp',
        content: 'Hello! I will be arriving at 3 PM. Is early check-in possible?'
      },
      {
        thread_id: thread.id,
        origin_role: 'host',
        direction: 'outgoing', 
        channel: 'whatsapp',
        content: 'Hello! Yes, early check-in is available. Please let us know when you arrive at the building.'
      },
      {
        thread_id: thread.id,
        origin_role: 'guest',
        direction: 'incoming',
        channel: 'whatsapp',
        content: 'Thank you! I am here now. How do I get the keys?'
      },
      {
        thread_id: thread.id,
        origin_role: 'assistant',
        direction: 'outgoing',
        channel: 'inapp',
        content: 'Guest has arrived and is requesting key pickup instructions. Please respond.'
      }
    ];

    for (const msg of sampleMessages) {
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert(msg)
        .select()
        .single();

      if (msgError) {
        console.error('❌ Failed to create message:', msgError.message);
        continue;
      }

      console.log(`✅ Created ${msg.origin_role} message: ${msg.content.substring(0, 50)}...`);
    }

    // Test the API endpoint
    console.log('\n🌐 Testing API endpoints...');
    
    const response = await fetch('http://localhost:3001/api/communication/threads', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API endpoint working, found', data.length, 'threads');
    } else {
      console.error('❌ API endpoint failed:', response.status, response.statusText);
    }

    console.log('\n🎉 Communication feature test completed successfully!');
    console.log('📱 You can now view messages in the frontend at /messages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCommunication();
