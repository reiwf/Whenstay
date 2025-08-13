import React from 'react';
import { ChevronDown } from 'lucide-react';

const CHANNEL_CONFIG = {
  beds24: { label: 'Beds24', icon: '🛏️', color: 'bg-orange-100 text-orange-800' },
  whatsapp: { label: 'WhatsApp', icon: '🟢', color: 'bg-green-100 text-green-800' },
  inapp: { label: 'In-App', icon: '💬', color: 'bg-blue-100 text-blue-800' },
  email: { label: 'Email', icon: '✉️', color: 'bg-purple-100 text-purple-800' },
  sms: { label: 'SMS', icon: '📱', color: 'bg-yellow-100 text-yellow-800' }
};

export default function ChannelSelector({ availableChannels, selectedChannel, onChannelChange }) {
  return (
    <div className="relative">
      <select
        value={selectedChannel}
        onChange={(e) => onChannelChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        {availableChannels.map((channel) => (
          <option key={channel} value={channel}>
            {CHANNEL_CONFIG[channel]?.icon} {CHANNEL_CONFIG[channel]?.label || channel}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
