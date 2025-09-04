import React from 'react';

export default function GlassCard({ children, className = '', hover = true, ...props }) {
  return (
    <div 
      className={`
        relative rounded-2xl border border-white/50 bg-white/40 backdrop-blur-md 
        shadow-[0_6px_20px_rgba(36,38,45,0.08)]
        ${hover ? 'hover:shadow-[0_8px_32px_rgba(36,38,45,0.12)] hover:bg-white/60 transition-all duration-200' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Subtle sheen overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 via-white/10 to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
