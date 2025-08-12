const request = require('supertest');
const app = require('../server');
const { supabase } = require('../config/supabase');

describe('Communication API', () => {
  let testThread;
  let testMessage;
  let authToken;

  beforeAll(async () => {
    // Setup test authentication
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123'
    });
    authToken = authData.session.access_token;
  });

  beforeEach(async () => {
    // Clean up test data
    await supabase
      .from('message_deliveries')
      .delete()
      .like('message_id', '%test%');
    
    await supabase
      .from('messages')
      .delete()
      .like('id', '%test%');
    
    await supabase
      .from('thread_channels')
      .delete()
      .like('thread_id', '%test%');
    
    await supabase
      .from('message_threads')
      .delete()
      .like('id', '%test%');
  });

  afterAll(async () => {
    // Final cleanup
    await supabase
      .from('message_deliveries')
      .delete()
      .like('message_id', '%test%');
    
    await supabase
      .from('messages')
      .delete()
      .like('id', '%test%');
    
    await supabase
      .from('thread_channels')
      .delete()
      .like('thread_id', '%test%');
    
    await supabase
      .from('message_threads')
      .delete()
      .like('id', '%test%');
  });

  describe('POST /api/admin/communication/threads', () => {
    it('should create a new message thread', async () => {
      const threadData = {
        subject: 'Test Thread',
        reservation_id: null,
        channels: ['inapp', 'whatsapp']
      };

      const response = await request(app)
        .post('/api/admin/communication/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .send(threadData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.thread).toHaveProperty('id');
      expect(response.body.thread.subject).toBe(threadData.subject);
      expect(response.body.thread.status).toBe('open');

      testThread = response.body.thread;
    });

    it('should return 400 for invalid thread data', async () => {
      const invalidData = {
        // Missing required fields
      };

      await request(app)
        .post('/api/admin/communication/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/admin/communication/threads', () => {
    beforeEach(async () => {
      // Create test thread
      const { data: thread } = await supabase
        .from('message_threads')
        .insert({
          id: 'test-thread-1',
          subject: 'Test Thread 1',
          status: 'open'
        })
        .select()
        .single();
      
      testThread = thread;
    });

    it('should retrieve message threads', async () => {
      const response = await request(app)
        .get('/api/admin/communication/threads')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.threads).toBeInstanceOf(Array);
      expect(response.body.threads.length).toBeGreaterThan(0);
    });

    it('should filter threads by status', async () => {
      const response = await request(app)
        .get('/api/admin/communication/threads?status=open')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.threads.forEach(thread => {
        expect(thread.status).toBe('open');
      });
    });

    it('should paginate threads', async () => {
      const response = await request(app)
        .get('/api/admin/communication/threads?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.threads).toHaveLength(1);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('offset');
    });
  });

  describe('POST /api/admin/communication/threads/:threadId/messages', () => {
    beforeEach(async () => {
      // Create test thread
      const { data: thread } = await supabase
        .from('message_threads')
        .insert({
          id: 'test-thread-2',
          subject: 'Test Thread 2',
          status: 'open'
        })
        .select()
        .single();
      
      testThread = thread;
    });

    it('should send a message to a thread', async () => {
      const messageData = {
        channel: 'inapp',
        content: 'Test message content',
        origin_role: 'host'
      };

      const response = await request(app)
        .post(`/api/admin/communication/threads/${testThread.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toHaveProperty('id');
      expect(response.body.message.content).toBe(messageData.content);
      expect(response.body.message.channel).toBe(messageData.channel);
      expect(response.body.message.direction).toBe('outgoing');

      testMessage = response.body.message;
    });

    it('should return 404 for non-existent thread', async () => {
      const messageData = {
        channel: 'inapp',
        content: 'Test message',
        origin_role: 'host'
      };

      await request(app)
        .post('/api/admin/communication/threads/non-existent/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(404);
    });

    it('should return 400 for invalid message data', async () => {
      const invalidData = {
        // Missing required fields
        content: 'Test message'
      };

      await request(app)
        .post(`/api/admin/communication/threads/${testThread.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/admin/communication/threads/:threadId/messages', () => {
    beforeEach(async () => {
      // Create test thread and message
      const { data: thread } = await supabase
        .from('message_threads')
        .insert({
          id: 'test-thread-3',
          subject: 'Test Thread 3',
          status: 'open'
        })
        .select()
        .single();
      
      testThread = thread;

      const { data: message } = await supabase
        .from('messages')
        .insert({
          id: 'test-message-1',
          thread_id: testThread.id,
          content: 'Test message',
          channel: 'inapp',
          direction: 'incoming',
          origin_role: 'guest'
        })
        .select()
        .single();
      
      testMessage = message;
    });

    it('should retrieve messages for a thread', async () => {
      const response = await request(app)
        .get(`/api/admin/communication/threads/${testThread.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toBeInstanceOf(Array);
      expect(response.body.messages.length).toBeGreaterThan(0);
      expect(response.body.messages[0]).toHaveProperty('id');
      expect(response.body.messages[0]).toHaveProperty('content');
    });

    it('should return 404 for non-existent thread', async () => {
      await request(app)
        .get('/api/admin/communication/threads/non-existent/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/admin/communication/threads/:threadId/status', () => {
    beforeEach(async () => {
      // Create test thread
      const { data: thread } = await supabase
        .from('message_threads')
        .insert({
          id: 'test-thread-4',
          subject: 'Test Thread 4',
          status: 'open'
        })
        .select()
        .single();
      
      testThread = thread;
    });

    it('should update thread status', async () => {
      const response = await request(app)
        .put(`/api/admin/communication/threads/${testThread.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'closed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.thread.status).toBe('closed');
    });

    it('should return 400 for invalid status', async () => {
      await request(app)
        .put(`/api/admin/communication/threads/${testThread.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });
  });

  describe('POST /api/admin/communication/templates', () => {
    it('should create a message template', async () => {
      const templateData = {
        name: 'Test Template',
        channel: 'inapp',
        language: 'en',
        content: 'Hello {{guest_name}}, welcome to {{property_name}}!'
      };

      const response = await request(app)
        .post('/api/admin/communication/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.template).toHaveProperty('id');
      expect(response.body.template.name).toBe(templateData.name);
    });
  });

  describe('POST /api/admin/communication/schedule', () => {
    beforeEach(async () => {
      // Create test thread and template
      const { data: thread } = await supabase
        .from('message_threads')
        .insert({
          id: 'test-thread-5',
          subject: 'Test Thread 5',
          status: 'open'
        })
        .select()
        .single();
      
      testThread = thread;
    });

    it('should schedule a message', async () => {
      const scheduleData = {
        thread_id: testThread.id,
        channel: 'inapp',
        content: 'Scheduled test message',
        run_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };

      const response = await request(app)
        .post('/api/admin/communication/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.scheduled_message).toHaveProperty('id');
      expect(response.body.scheduled_message.status).toBe('queued');
    });

    it('should return 400 for past schedule time', async () => {
      const scheduleData = {
        thread_id: testThread.id,
        channel: 'inapp',
        content: 'Past scheduled message',
        run_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      };

      await request(app)
        .post('/api/admin/communication/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleData)
        .expect(400);
    });
  });

  describe('Authentication', () => {
    it('should return 401 for requests without auth token', async () => {
      await request(app)
        .get('/api/admin/communication/threads')
        .expect(401);
    });

    it('should return 401 for requests with invalid auth token', async () => {
      await request(app)
        .get('/api/admin/communication/threads')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple rapid requests', async () => {
      const promises = Array(10).fill().map(() =>
        request(app)
          .get('/api/admin/communication/threads')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed (or some might be rate limited)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});

describe('Communication Service Functions', () => {
  const communicationService = require('../services/communicationService');

  describe('validateMessageData', () => {
    it('should validate correct message data', () => {
      const validData = {
        channel: 'inapp',
        content: 'Test message',
        origin_role: 'host'
      };

      expect(() => {
        communicationService.validateMessageData(validData);
      }).not.toThrow();
    });

    it('should throw error for invalid channel', () => {
      const invalidData = {
        channel: 'invalid_channel',
        content: 'Test message',
        origin_role: 'host'
      };

      expect(() => {
        communicationService.validateMessageData(invalidData);
      }).toThrow('Invalid channel');
    });

    it('should throw error for empty content', () => {
      const invalidData = {
        channel: 'inapp',
        content: '',
        origin_role: 'host'
      };

      expect(() => {
        communicationService.validateMessageData(invalidData);
      }).toThrow('Content cannot be empty');
    });
  });

  describe('formatThreadResponse', () => {
    it('should format thread data correctly', () => {
      const threadData = {
        id: 'test-id',
        subject: 'Test Subject',
        status: 'open',
        created_at: '2024-01-01T00:00:00Z',
        last_message_at: '2024-01-01T01:00:00Z',
        reservation_id: 'res-123'
      };

      const formatted = communicationService.formatThreadResponse(threadData);

      expect(formatted).toHaveProperty('id', 'test-id');
      expect(formatted).toHaveProperty('subject', 'Test Subject');
      expect(formatted).toHaveProperty('status', 'open');
      expect(formatted).toHaveProperty('created_at');
      expect(formatted).toHaveProperty('last_message_at');
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variables', () => {
      const template = 'Hello {{guest_name}}, welcome to {{property_name}}!';
      const variables = {
        guest_name: 'John Doe',
        property_name: 'Test Hotel'
      };

      const rendered = communicationService.renderTemplate(template, variables);
      expect(rendered).toBe('Hello John Doe, welcome to Test Hotel!');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{guest_name}}, welcome to {{property_name}}!';
      const variables = {
        guest_name: 'John Doe'
        // missing property_name
      };

      const rendered = communicationService.renderTemplate(template, variables);
      expect(rendered).toBe('Hello John Doe, welcome to {{property_name}}!');
    });
  });

  describe('Channel validation', () => {
    it('should validate supported channels', () => {
      const supportedChannels = ['beds24', 'whatsapp', 'inapp', 'email', 'sms'];
      
      supportedChannels.forEach(channel => {
        expect(communicationService.isValidChannel(channel)).toBe(true);
      });
    });

    it('should reject unsupported channels', () => {
      const unsupportedChannels = ['facebook', 'telegram', 'slack'];
      
      unsupportedChannels.forEach(channel => {
        expect(communicationService.isValidChannel(channel)).toBe(false);
      });
    });
  });
});
