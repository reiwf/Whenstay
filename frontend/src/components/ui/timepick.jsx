import React, { useEffect, useMemo, useRef, useState, useId } from 'react';

export default function TimePicker({
  value: controlledValue,
  onChange,
  format = '24',
  step = 15,
  min,
  max,
  placeholder = 'HH:mm',
  disabled = false,
  clearable = true,
  overnightRange,
  className = '',
  error = false, // API compat
}) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(null);
  const value = isControlled ? controlledValue : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [filterText, setFilterText] = useState('');
  const [displayText, setDisplayText] = useState('');

  const inputRef = useRef(null);
  const popRef = useRef(null);
  const listboxId = useId();

  // ---- time helpers
  const parse24 = (str) => {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]); const mm = Number(m[2]);
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
  };
  const to24 = (str) => {
    if (!str) return null;
    if (format === '24') return parse24(str);
    const m = str.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!m) return parse24(str);
    let h = Number(m[1]); const mm = Number(m[2]); const ap = m[3].toUpperCase();
    if (h === 12) h = 0; if (ap === 'PM') h += 12;
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
  };
  const fmt24 = (mins) => `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
  const fmt12 = (mins) => {
    let h24 = Math.floor(mins/60); const m = mins%60; const am = h24 < 12;
    let h = h24 % 12; if (h === 0) h = 12;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${am ? 'AM':'PM'}`;
  };
  const toDisplay = (mins) => (format === '24' ? fmt24(mins) : fmt12(mins));

  // ---- options (supports overnight windows)
  const options = useMemo(() => {
    const out = []; const DAY = 24*60;
    const startFrom = (mins) => ((Math.ceil(mins/step)*step) % DAY);
    const pushRange = (from,to) => {
      for (let m = startFrom(from); m <= to; m += step) {
        out.push({ value: fmt24(m), label: toDisplay(m), mins: m, key: `${m}` });
      }
    };
    if (overnightRange?.start && overnightRange?.end) {
      const s = parse24(overnightRange.start); const e = parse24(overnightRange.end);
      if (s == null || e == null) return out;
      if (e < s) { pushRange(s, DAY-1); pushRange(0, e); } else { pushRange(s, e); }
      return out;
    }
    const minMins = min ? parse24(min) : 0;
    const maxMins = max ? parse24(max) : DAY - 1;
    pushRange(minMins ?? 0, maxMins ?? DAY-1);
    return out;
  }, [step, format, min, max, overnightRange?.start, overnightRange?.end]);

  const filtered = useMemo(() => {
    if (!filterText.trim()) return options;
    const f = filterText.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(f));
  }, [filterText, options]);

  useEffect(() => { setHighlightIndex(filtered.length ? 0 : -1); }, [open, filterText, options.length]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    const vMins = to24(value);
    setDisplayText(vMins != null ? toDisplay(vMins) : '');
  }, [value, format]); // eslint-disable-line

  // ---- handlers
  const commitChange = (vStr) => {
    const next = format === '24' ? vStr : toDisplay(parse24(vStr));
    onChange?.(next);
    if (!isControlled) setUncontrolledValue(next);
    setOpen(false); setFilterText('');
  };
  const handleInputChange = (e) => {
    const t = e.target.value; setDisplayText(t); setFilterText(t);
    if (!open) setOpen(true);
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); e.preventDefault(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(i => clamp(i+1, 0, filtered.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(i => clamp(i-1, 0, filtered.length-1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const opt = filtered[highlightIndex]; if (opt) commitChange(opt.value); }
    else if (e.key === 'Escape') { setOpen(false); }
  };
  const clear = (e) => { e.stopPropagation(); onChange?.(null); if (!isControlled) setUncontrolledValue(null); setDisplayText(''); setFilterText(''); };

  // ---- render
  return (
    <div className={`relative w-full ${className}`}>
      {/* Fixed 44px row to match inputs */}
       <div
          className="flex items-center gap-2 h-10 w-full min-w-0 overflow-hidden rounded-lg"
          onClick={() => !disabled && setOpen(true)}
        >
        <input
          ref={inputRef}
          type="text"
          value={displayText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          className={[
            // center the text visually (no giant line-height)
            'flex-1 bg-transparent border-none outline-none ring-0 text-[15px]',
            'h-10 leading-none py-0.5',          // <- key change
            'placeholder-slate-400'
          ].join(' ')}
        />

        <span className="text-[11px] text-slate-600 bg-slate-100 rounded-md px-1.5 py-0.5 select-none self-center">
          {format === '24' ? '24h' : '12h'}
        </span>

         {clearable && value && !disabled && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear time"
              className="text-slate-400 hover:text-slate-600 self-center"
            >
              ×
            </button>
          )}
      </div>

      {/* Dropdown opens UP */}
      {open && (
        <div
          ref={popRef}
          role="listbox"
          id={listboxId}
          tabIndex={-1}
          className="absolute bottom-full mb-1 left-0 right-0 z-50
                     rounded-2xl bg-white/95 backdrop-blur
                     ring-1 ring-slate-200 shadow-lg overflow-hidden"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((opt, idx) => {
                const selected = value && to24(value) === opt.mins;
                const highlighted = idx === highlightIndex;
                return (
                  <div
                    key={opt.key}
                    role="option"
                    aria-selected={selected}
                    className={[
                      'px-3 py-2 text-[15px] cursor-pointer select-none',
                      highlighted ? 'bg-slate-50' : '',
                      selected ? 'font-semibold text-slate-900' : 'text-slate-800',
                    ].join(' ')}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => commitChange(opt.value)}
                  >
                    {opt.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
