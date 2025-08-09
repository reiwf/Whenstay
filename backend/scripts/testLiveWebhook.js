const axios = require('axios');

async function testLiveWebhook() {
  console.log('🌐 Testing live webhook endpoint...\n');

  const webhookUrl = 'https://staylabel.fly.dev/api/webhooks/beds24';
  
  const testPayload = {
    "event": "booking_new",
    "eventId": `test-webhook-${Date.now()}`,
    "booking": {
      "id": `TEST-${Date.now()}`,
      "propertyId": "285552",
      "roomId": "595552",
      "unitId": "1",
      "firstName": "Test",
      "lastName": "User", 
      "email": "test@example.com",
      "phone": "+1234567890",
      "arrival": "2024-01-15",
      "departure": "2024-01-18",
      "numAdult": 2,
      "numChild": 0,
      "price": 300.00,
      "currency": "USD",
      "status": "confirmed"
    }
  };

  try {
    console.log(`Sending test webhook to: ${webhookUrl}`);
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    
    const startTime = Date.now();
    
    const response = await axios.post(webhookUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Beds24-Webhook-Test'
      },
      timeout: 10000
    });

    const responseTime = Date.now() - startTime;

    console.log('\n✅ Webhook endpoint response:');
    console.log(`Status: ${response.status}`);
    console.log(`Response time: ${responseTime}ms`);
    console.log(`Data:`, response.data);

    if (responseTime > 5000) {
      console.log('\n⚠️ WARNING: Response time > 5 seconds');
      console.log('This suggests the machine was sleeping and had to wake up.');
      console.log('Beds24 webhooks typically timeout after 5-10 seconds.');
    }

  } catch (error) {
    console.error('\n❌ Webhook endpoint test failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - server not reachable');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Request timed out - likely machine sleep issue');
    } else if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testLiveWebhook();
