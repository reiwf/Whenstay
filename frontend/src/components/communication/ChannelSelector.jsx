import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import airbnbLogo from '../../../shared/airbnblogo.png';
import bookingLogo from '../../../shared/bookinglogo.png';
import staylabelLogo from'../../../shared/staylabellogo.png';

const CHANNEL_CONFIG = {
  beds24:    { label: 'Beds24',      icon: '🛏️',  color: 'bg-orange-100 text-orange-800' },
  whatsapp:  { label: 'WhatsApp',    icon: '🟢',  color: 'bg-green-100 text-green-800'   },
  inapp:     { label: 'In-App',      icon: null,  color: 'bg-blue-100 text-blue-800', logo: 'staylabel'     },
  email:     { label: 'Email',       icon: '✉️',  color: 'bg-purple-100 text-purple-800' },
  sms:       { label: 'SMS',         icon: '📱',  color: 'bg-yellow-100 text-yellow-800' },
  airbnb:    { label: 'Airbnb',      icon: null,  color: 'bg-orange-100 text-orange-800',  logo: 'airbnb' },
  'booking.com': {
    label: 'Booking.com',
    icon: null,
    color: 'bg-blue-100 text-blue-800',
    logo: 'booking'
  },
};

function ChannelRow({ channel, isActive, isHighlighted, onClick, onMouseEnter }) {
  const cfg = CHANNEL_CONFIG[channel] || { label: channel };

  return (
    <div
      role="option"
      aria-selected={isActive}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={[
        'group flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg cursor-pointer select-none',
        'transition-all duration-200 ease-in-out',
        isHighlighted || isActive
          ? 'bg-white/60 dark:bg-white/15 shadow-md scale-[1.02]'
          : 'hover:bg-white/40 dark:hover:bg-white/10 hover:shadow-sm hover:scale-[1.01]'
      ].join(' ')}
    >
      {/* Icon / Logo */}
      <div className="shrink-0 relative">
        {cfg.logo === 'airbnb' ? (
          <img src={airbnbLogo} alt="" className="h-4 w-4 object-contain" />
        ) : cfg.logo === 'booking' ? (
          <img src={bookingLogo} alt="" className="h-4 w-4 object-contain" />
        ) : cfg.logo === 'staylabel' ? (
          <img src={staylabelLogo} alt="" className="h-4 w-4 object-contain" />
        ) :cfg.icon ? (
          <span className="text-base leading-none">{cfg.icon}</span>
        ) : (
          <span className="inline-block h-4 w-4 rounded bg-slate-300/60" />
        )}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {cfg.label}
        </div>
        {cfg.color && (
          <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] ${cfg.color}`}>
            {channel}
          </span>
        )}
      </div>

      {/* Checkmark */}
      {isActive && (
        <Check className="h-4 w-4 text-slate-700/80 dark:text-slate-200/80" />
      )}
    </div>
  );
}


export default function ChannelSelector({
  availableChannels = [],
  selectedChannel,
  onChannelChange,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(() =>
    Math.max(0, availableChannels.indexOf(selectedChannel))
  );

  const btnRef = useRef(null);
  const popRef = useRef(null);

  const selectedCfg = useMemo(
    () => CHANNEL_CONFIG[selectedChannel] || { label: selectedChannel },
    [selectedChannel]
  );

  // Update highlighted index when availableChannels change
  useEffect(() => {
    const newIndex = Math.max(0, availableChannels.indexOf(selectedChannel));
    setHighlighted(newIndex);
  }, [availableChannels, selectedChannel]);

  // Ensure selectedChannel is valid when availableChannels change
  useEffect(() => {
    if (availableChannels.length > 0 && selectedChannel && !availableChannels.includes(selectedChannel)) {
      // Selected channel is not available, switch to first available channel
      console.log('ChannelSelector: Selected channel not available, switching to:', availableChannels[0]);
      onChannelChange?.(availableChannels[0]);
    } else if (availableChannels.length > 0 && !selectedChannel) {
      // No selected channel but channels are available, select first one
      console.log('ChannelSelector: No selected channel, selecting first available:', availableChannels[0]);
      onChannelChange?.(availableChannels[0]);
    }
  }, [availableChannels, selectedChannel, onChannelChange]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        popRef.current &&
        !popRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((i) => (i + 1) % availableChannels.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((i) =>
          (i - 1 + availableChannels.length) % availableChannels.length
        );
      } else if (e.key === 'Home') {
        e.preventDefault();
        setHighlighted(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setHighlighted(availableChannels.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const ch = availableChannels[highlighted];
        if (ch) {
          onChannelChange?.(ch);
          setOpen(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, highlighted, availableChannels, onChannelChange]);

  const handleToggle = () => setOpen((v) => !v);

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Glassy trigger button */}
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={handleToggle}
        className={[
          'group relative inline-flex items-center gap-2 pl-9 pr-8 py-2 rounded-xl',
          'text-sm font-medium text-slate-800 dark:text-slate-100',
          // glassy styles
          'bg-white/25 dark:bg-slate-900/30',
          'backdrop-blur-md',
          'border border-white/40 dark:border-white/10',
          'shadow-[0_6px_20px_rgba(36,38,45,0.18)]',
          'ring-1 ring-black/5',
          'hover:bg-white/35 dark:hover:bg-slate-900/40',
          'transition-colors'
        ].join(' ')}
      >
        {/* subtle highlight sheen */}
        <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/50 via-white/15 to-transparent opacity-70" />

        {/* Left icon / logo */}
        <span className="absolute left-3 top-1/2 -translate-y-1/2">
          {selectedCfg.logo === 'airbnb' ? (
            <img src={airbnbLogo} alt="" className="h-4 w-4 object-contain" />
          ) : selectedCfg.logo === 'booking' ? (
            <img src={bookingLogo} alt="" className="h-4 w-4 object-contain" />
          ) : selectedCfg.logo === 'staylabel' ? (
            <img src={staylabelLogo} alt="" className="h-4 w-4 object-contain" />
          ) : selectedCfg.icon ? (
            <span className="text-sm">{selectedCfg.icon}</span>
          ) : (
            <span className="inline-block h-4 w-4 rounded bg-slate-300/60" />
          )}
        </span>

        {/* Label */}
        <span className="relative z-10 truncate">{selectedCfg.label || selectedChannel}</span>

        {/* Chevron */}
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600/70 dark:text-slate-300/70" />
      </button>

      {/* Popover menu */}
      {open && (
        <div
          ref={popRef}
          role="listbox"
          tabIndex={-1}
          className={[
            'absolute z-50 bottom-full mb-2 min-w-[240px] max-h-72 overflow-auto',
            'rounded-2xl p-2',
            // glassy
            'bg-white/30 dark:bg-slate-900/35',
            'backdrop-blur-xl',
            'border border-white/40 dark:border-white/10',
            'shadow-2xl ring-1 ring-black/5'
          ].join(' ')}
          style={{ left: 0 }}
        >
          {/* inner sheen */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/50 via-transparent to-white/30" />

          <div className="relative space-y-1">
            {availableChannels.map((ch, idx) => (
              <ChannelRow
                key={ch}
                channel={ch}
                isActive={ch === selectedChannel}
                isHighlighted={idx === highlighted}
                onClick={() => {
                  onChannelChange?.(ch);
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlighted(idx)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
