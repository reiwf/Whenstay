import React from 'react';
import { ChevronDown } from 'lucide-react';
import airbnbLogo from '../../../shared/airbnblogo.png';

const CHANNEL_CONFIG = {
  beds24:    { label: 'Beds24',     icon: '🛏️', color: 'bg-orange-100 text-orange-800' },
  whatsapp:  { label: 'WhatsApp',   icon: '🟢', color: 'bg-green-100 text-green-800' },
  inapp:     { label: 'In-App',     icon: '💬', color: 'bg-blue-100 text-blue-800' },
  email:     { label: 'Email',      icon: '✉️', color: 'bg-purple-100 text-purple-800' },
  sms:       { label: 'SMS',        icon: '📱', color: 'bg-yellow-100 text-yellow-800' },
  airbnb:    { label: 'Airbnb',     icon: null, color: 'bg-orange-100 text-orange-800' }, // icon handled by logo
  bookingcom:{ label: 'Booking.com',icon: '🏠', color: 'bg-blue-100 text-blue-800' }
};

export default function ChannelSelector({ availableChannels, selectedChannel, onChannelChange }) {
  const selectedConfig = CHANNEL_CONFIG[selectedChannel] || { label: selectedChannel };

  return (
    <div className="relative inline-block">
      {/* Left icon / logo overlay */}
      {selectedChannel === 'airbnb' ? (
        <img
          src={airbnbLogo}
          alt=""
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 object-contain"
        />
      ) : selectedConfig.icon ? (
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
          aria-hidden="true"
        >
          {selectedConfig.icon}
        </span>
      ) : null}

      <select
        value={selectedChannel}
        onChange={(e) => onChannelChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 pl-9 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        {availableChannels.map((channel) => (
          <option key={channel} value={channel}>
            {CHANNEL_CONFIG[channel]?.label || channel}
          </option>
        ))}
      </select>

      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
