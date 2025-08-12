import React, { useState, useEffect, useRef } from 'react';

// Mock data for demonstration
const mockThreads = [
  {
    id: '1',
    subject: 'Welcome to Tokyo Apartment',
    status: 'open',
    last_message_at: '2025-01-08T14:30:00Z',
    last_message_preview: 'Hello! Welcome to your stay...'
  },
  {
    id: '2', 
    subject: 'Osaka Business Hotel - Room 301',
    status: 'open',
    last_message_at: '2025-01-08T12:15:00Z',
    last_message_preview: 'Thank you for the quick response...'
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
      created_at: '2025-01-08T14:00:00Z'
    },
    {
      id: '2',
      thread_id: '1',
      origin_role: 'host',
      direction: 'outgoing',
      channel: 'whatsapp',
      content: 'Hello! Yes, early check-in is available. Please let us know when you arrive at the building.',
      created_at: '2025-01-08T14:05:00Z'
    },
    {
      id: '3',
      thread_id: '1',
      origin_role: 'guest',
      direction: 'incoming',
      channel: 'whatsapp',
      content: 'Thank you! I am here now. How do I get the keys?',
      created_at: '2025-01-08T14:25:00Z'
    },
    {
      id: '4',
      thread_id: '1',
      origin_role: 'assistant',
      direction: 'outgoing',
      channel: 'inapp',
      content: 'Guest has arrived and is requesting key pickup instructions. Please respond.',
      created_at: '2025-01-08T14:30:00Z'
    }
  ],
  '2': [
    {
      id: '5',
      thread_id: '2',
      origin_role: 'guest',
      direction: 'incoming',
      channel: 'email',
      content: 'I need to extend my stay by one more night. Is this possible?',
      created_at: '2025-01-08T12:00:00Z'
    },
    {
      id: '6',
      thread_id: '2',
      origin_role: 'host',
      direction: 'outgoing',
      channel: 'email',
      content: 'Let me check availability for you. I will get back to you within an hour.',
      created_at: '2025-01-08T12:15:00Z'
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
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm border text-sm ${
                m.direction === 'incoming' 
                  ? 'bg-white border-neutral-200' 
                  : m.origin_role === 'assistant'
                  ? 'bg-purple-50 border-purple-100'
                  : 'bg-blue-50 border-blue-100'
              }`}>
                <div className="flex items-center gap-1 text-xs text-neutral-500 mb-1">
                  <span>{CHANNEL_ICONS[m.channel]}</span>
                  <span className="capitalize">{m.origin_role}</span>
                  <span className="text-neutral-400">•</span>
                  <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
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
