import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from '../components/communication/MessageBubble';

// Mock data for demonstration
const mockThreads = [
  {
    id: '1',
    subject: 'Welcome to Tokyo Apartment',
    status: 'open',
    last_message_at: '2025-01-08T14:30:00Z',
    last_message_preview: 'Guest has successfully received key pickup instructions with photo guidance...'
  },
  {
    id: '2', 
    subject: 'Osaka Business Hotel - Room 301',
    status: 'open',
    last_message_at: '2025-01-08T12:45:00Z',
    last_message_preview: 'Also, I noticed a small issue with the bathroom door. Here\'s a photo:'
  }
];

const mockMessages = {
  '1': [
    {
      id: '1',
      thread_id: '1',
      origin_role: 'guest',
      direction: 'incoming',
      channel: 'whatsapp',
      content: 'Hello! I will be arriving at 3 PM. Is early check-in possible?',
      created_at: '2025-01-08T14:00:00Z',
      message_deliveries: [{ status: 'read', read_at: '2025-01-08T14:02:00Z' }]
    },
    {
      id: '2',
      thread_id: '1',
      origin_role: 'host',
      direction: 'outgoing',
      channel: 'whatsapp',
      content: 'Hello! Yes, early check-in is available. Please let us know when you arrive at the building.',
      created_at: '2025-01-08T14:05:00Z',
      message_deliveries: [{ status: 'delivered', delivered_at: '2025-01-08T14:05:30Z' }]
    },
    {
      id: '3',
      thread_id: '1',
      origin_role: 'guest',
      direction: 'incoming',
      channel: 'whatsapp',
      content: 'Thank you! I am here now. How do I get the keys? <a href="https://a0.muscache.com/im/pictures-signed/messaging/Messaging-2258135412/original/440e1fec-c277-42bb-8360-bcf1502cbdce.jpeg?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEBIaCXVzLWVhc3QtMSJFMEMCICtZbGgSsLEyz3GOXpTOOJawQ%2BxKFTmUyROrMpqfnqcxAh9txrQu3E0HAJBRzACoRlMDDViXYWAHRRuTbpFTeaLpKu8DCFoQABoMMTcyNjMxNDQ4MDE5IgyYh0alhYfGA4ZbAG8qzAMldFXCpEXZz6Ic8m%2F4mHawgM7Q4keIQpoQF1h9fxQX3hTGVr1yvBPqWM0i0XNHgtZLjotvSbEEBlVsSpJdrV2wVts5THpbjb5NaKr3DoUQkiVEe8VIs53cg4tl%2Fb6NTkfg2Dd2P5Ta5iAqGvmOdD5%2BVk04NiCPNGPT4I8hx40naIZAM68JoUPhFBpYanW1v%2B34wl3qL%2B5ZoXuGk7UBj33hpy2i1Hz%2FPMzUhCkbpryK2sHFd7nUxI3LSOT%2F1lOpkpFArzyBY2yZ9NYDn9YXjkpDZTp7VlDu8BzgXt0hJoWO5fVjnglgiOJK5TSA37hJNvPIfUA2k0RqPTs8GoNjXAKalsBSW1Mkb0vmQRblZwcpsV6sRhEmNbxd8%2Fer9iPrSzOmfJtYjxGu%2BYzM3Qmtf81KoviEttBV7n6RhdRTWX7XcovaeGeMfTmP0DH5TFu4lt9q3BWbV1gc6v6XfSc2DWvbRTqaYT2wdIWbkyTdSL6xriWyD1swVQvflxcztLuhJ%2BjKGSsaS1YMz1z1ktGY9xUzKoq8plXFNJzPh478YYNgCvwSQwT4Z7By2cWnCyY0xSVwNqePEqfQzjs2lGKzmNsTyufENidbhfi6kjNFMP%2F1%2B8QGOpYB9thXpl337zakigdDTWHCZhA7%2FPyoy7NyWVGJXroKU%2FDdEO0LysZWQsleWbtA1MyAsUgw9rGwNWp0%2FY8jtJXfaKldOCRWlNFjEhowN4eONY2FQS8ILFxoquaXxuXxhmVqW2GMGOb4WfSMSHleKJE8oAbFS5PmOEWRWra3rKZkGlZjT13zpl14rvtrJaYCT2vqDSV3ial9&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250815T100228Z&X-Amz-SignedHeaders=host&X-Amz-Credential=ASIASQMNC3HJUT7VDKES%2F20250815%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Expires=3600&X-Amz-Signature=2b62ef28682b40cc6fb2c4f15f5c2144d9753ed2b9636b617a994307d9fc1e61&im_w=1200" target="_blank"><img src="https://a0.muscache.com/im/pictures-signed/messaging/Messaging-2258135412/original/440e1fec-c277-42bb-8360-bcf1502cbdce.jpeg?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEBIaCXVzLWVhc3QtMSJFMEMCICtZbGgSsLEyz3GOXpTOOJawQ%2BxKFTmUyROrMpqfnqcxAh9txrQu3E0HAJBRzACoRlMDDViXYWAHRRuTbpFTeaLpKu8DCFoQABoMMTcyNjMxNDQ4MDE5IgyYh0alhYfGA4ZbAG8qzAMldFXCpEXZz6Ic8m%2F4mHawgM7Q4keIQpoQF1h9fxQX3hTGVr1yvBPqWM0i0XNHgtZLjotvSbEEBlVsSpJdrV2wVts5THpbjb5NaKr3DoUQkiVEe8VIs53cg4tl%2Fb6NTkfg2Dd2P5Ta5iAqGvmOdD5%2BVk04NiCPNGPT4I8hx40naIZAM68JoUPhFBpYanW1v%2B34wl3qL%2B5ZoXuGk7UBj33hpy2i1Hz%2FPMzUhCkbpryK2sHFd7nUxI3LSOT%2F1lOpkpFArzyBY2yZ9NYDn9YXjkpDZTp7VlDu8BzgXt0hJoWO5fVjnglgiOJK5TSA37hJNvPIfUA2k0RqPTs8GoNjXAKalsBSW1Mkb0vmQRblZwcpsV6sRhEmNbxd8%2Fer9iPrSzOmfJtYjxGu%2BYzM3Qmtf81KoviEttBV7n6RhdRTWX7XcovaeGeMfTmP0DH5TFu4lt9q3BWbV1gc6v6XfSc2DWvbRTqaYT2wdIWbkyTdSL6xriWyD1swVQvflxcztLuhJ%2BjKGSsaS1YMz1z1ktGY9xUzKoq8plXFNJzPh478YYNgCvwSQwT4Z7By2cWnCyY0xSVwNqePEqfQzjs2lGKzmNsTyufENidbhfi6kjNFMP%2F1%2B8QGOpYB9thXpl337zakigdDTWHCZhA7%2FPyoy7NyWVGJXroKU%2FDdEO0LysZWQsleWbtA1MyAsUgw9rGwNWp0%2FY8jtJXfaKldOCRWlNFjEhowN4eONY2FQS8ILFxoquaXxuXxhmVqW2GMGOb4WfSMSHleKJE8oAbFS5PmOEWRWra3rKZkGlZjT13zpl14rvtrJaYCT2vqDSV3ial9&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20250815T100228Z&X-Amz-SignedHeaders=host&X-Amz-Credential=ASIASQMNC3HJUT7VDKES%2F20250815%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Expires=3600&X-Amz-Signature=2b62ef28682b40cc6fb2c4f15f5c2144d9753ed2b9636b617a994307d9fc1e61&im_w=1200" style="height:100px"></a>',
      created_at: '2025-01-08T14:25:00Z',
      message_deliveries: [{ status: 'read', read_at: '2025-01-08T14:26:00Z' }]
    },
    {
      id: '4',
      thread_id: '1',
      origin_role: 'host',
      direction: 'outgoing',
      channel: 'whatsapp',
      content: 'Perfect! I can see you\'re at the right entrance. The key lockbox is located to the right of the main door. Here\'s what it looks like:',
      created_at: '2025-01-08T14:28:00Z',
      message_deliveries: [{ status: 'delivered', delivered_at: '2025-01-08T14:28:15Z' }],
      message_attachments: [
        {
          path: 'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          content_type: 'image/jpeg',
          size_bytes: 89234
        }
      ]
    },
    {
      id: '5',
      thread_id: '1',
      origin_role: 'assistant',
      direction: 'outgoing',
      channel: 'inapp',
      content: 'Guest has successfully received key pickup instructions with photo guidance. Check-in is proceeding smoothly.',
      created_at: '2025-01-08T14:30:00Z'
    }
  ],
  '2': [
    {
      id: '6',
      thread_id: '2',
      origin_role: 'guest',
      direction: 'incoming',
      channel: 'email',
      content: 'I need to extend my stay by one more night. Is this possible?',
      created_at: '2025-01-08T12:00:00Z',
      message_deliveries: [{ status: 'read', read_at: '2025-01-08T12:02:00Z' }]
    },
    {
      id: '7',
      thread_id: '2',
      origin_role: 'host',
      direction: 'outgoing',
      channel: 'email',
      content: 'Let me check availability for you. I will get back to you within an hour.',
      created_at: '2025-01-08T12:15:00Z',
      message_deliveries: [{ status: 'delivered', delivered_at: '2025-01-08T12:15:45Z' }]
    },
    {
      id: '8',
      thread_id: '2',
      origin_role: 'guest',
      direction: 'incoming',
      channel: 'whatsapp',
      content: 'Also, I noticed a small issue with the bathroom door. Here\'s a photo:',
      created_at: '2025-01-08T12:45:00Z',
      message_deliveries: [{ status: 'delivered', delivered_at: '2025-01-08T12:45:10Z' }],
      message_attachments: [
        {
          path: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          content_type: 'image/jpeg',
          size_bytes: 124567
        }
      ]
    }
  ]
};

const mockReservation = {
  id: 'res-1',
  guest_name: 'Yuki Tanaka',
  check_in: '2025-01-08',
  check_out: '2025-01-11',
  phone: '+81-90-1234-5678',
  email: 'yuki.tanaka@email.com',
  property_name: 'Tokyo Central Apartment'
};

const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱'
};

export default function MessagingDemo() {
  const [threads] = useState(mockThreads);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('whatsapp');
  const [draft, setDraft] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  
  const listRef = useRef(null);

  useEffect(() => {
    if (selectedThread) {
      setMessages(mockMessages[selectedThread.id] || []);
    }
  }, [selectedThread]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0);
  }, [messages]);

  const sendMessage = () => {
    if (!selectedThread || !draft.trim()) return;
    
    const newMessage = {
      id: Date.now().toString(),
      thread_id: selectedThread.id,
      origin_role: 'host',
      direction: 'outgoing',
      channel: selectedChannel,
      content: draft.trim(),
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setDraft('');
  };

  const availableChannels = ['whatsapp', 'email', 'inapp', 'sms'];

  return (
    <div className="h-screen w-full grid grid-cols-12 gap-0 bg-neutral-50 text-neutral-900">
      {/* Left: Inbox */}
      <aside className="col-span-3 border-r border-neutral-200 bg-white flex flex-col">
        <div className="p-3 font-semibold border-b bg-neutral-50">Messages - Demo</div>
        <div className="overflow-y-auto flex-1">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedThread(t)}
              className={`w-full text-left p-3 border-b border-neutral-100 hover:bg-neutral-50 ${
                selectedThread?.id === t.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="text-sm font-medium truncate">{t.subject}</div>
              <div className="text-xs text-neutral-500 truncate">{t.last_message_preview}</div>
              <div className="text-[10px] text-neutral-400 mt-1">
                {new Date(t.last_message_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center: Thread */}
      <main className="col-span-6 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-200 bg-white flex items-center justify-between">
          <div>
            <div className="font-semibold">{selectedThread?.subject || 'Select a thread'}</div>
            {selectedThread && (
              <div className="text-xs text-neutral-500">Demo Mode - Thread ID: {selectedThread.id}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedThread && (
              <>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                >
                  {availableChannels.map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_ICONS[c]} {c}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={() => setScheduleOpen(true)}
                  className="text-sm px-3 py-1 border rounded hover:bg-neutral-50"
                >
                  Schedule
                </button>
                <button className="text-sm px-3 py-1 border rounded text-neutral-600 hover:bg-neutral-50">
                  Archive
                </button>
                <button className="text-sm px-3 py-1 border rounded text-neutral-600 hover:bg-neutral-50">
                  Close
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-neutral-50 to-neutral-100">
          {!selectedThread && (
            <div className="text-center text-neutral-500 mt-20">
              <div className="text-4xl mb-4">💬</div>
              <div className="text-lg font-medium mb-2">Communication Center</div>
              <div className="text-sm">Select a conversation to start messaging</div>
            </div>
          )}
          {selectedThread && messages.length === 0 && (
            <div className="text-sm text-neutral-500">No messages yet</div>
          )}
          {messages.map((m, index) => (
            <MessageBubble 
              key={m.id} 
              message={m} 
              showTimestamp={index === 0 || (index > 0 && 
                new Date(m.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000
              )}
              onMarkAsRead={(messageId, channel) => {
                console.log(`Demo: Would mark message ${messageId} as read on ${channel}`);
              }}
            />
          ))}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-neutral-200 bg-white flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={selectedThread ? "Type a message..." : "Select a thread to start messaging"}
            disabled={!selectedThread}
            className="flex-1 border rounded-lg p-2 text-sm h-20 resize-none disabled:bg-neutral-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            disabled={!selectedThread || !draft.trim()}
            onClick={sendMessage}
            className="bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </div>
      </main>

      {/* Right: Reservation details */}
      <aside className="col-span-3 border-l border-neutral-200 bg-white p-3">
        <div className="font-semibold mb-3">Reservation Details</div>
        {!selectedThread && <div className="text-sm text-neutral-500">Select a thread</div>}
        {selectedThread && (
          <div className="space-y-3 text-sm">
            <div className="bg-neutral-50 rounded-lg p-3">
              <div className="font-medium text-lg mb-2">{mockReservation.guest_name}</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Check-in:</span>
                  <span>{new Date(mockReservation.check_in).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Check-out:</span>
                  <span>{new Date(mockReservation.check_out).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Phone:</span>
                  <span className="text-blue-600">{mockReservation.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Email:</span>
                  <span className="text-blue-600 text-xs">{mockReservation.email}</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-neutral-500 italic">{mockReservation.property_name}</div>
          </div>
        )}
      </aside>

      {/* Schedule Modal */}
      {scheduleOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[520px] max-w-[92vw] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Schedule a message</div>
              <button onClick={() => setScheduleOpen(false)} className="text-neutral-500 hover:text-neutral-700">✕</button>
            </div>
            <div className="text-sm text-neutral-600 mb-4">
              This is a demo. In the full version, you would be able to schedule automated messages using templates.
            </div>
            <div className="flex items-center justify-end gap-2">
              <button 
                className="px-3 py-1 border rounded hover:bg-neutral-50" 
                onClick={() => setScheduleOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
