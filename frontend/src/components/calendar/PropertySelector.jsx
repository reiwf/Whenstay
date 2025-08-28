import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search, Check, Building2 } from 'lucide-react';
import api from '../../services/api';

/**
 * PropertySelector - Glassy dropdown for calendar property selection
 * Props:
 *  - selectedPropertyId
 *  - onPropertyChange(id)
 *  - className
 *  - disabled
 */
export default function PropertySelector({
  selectedPropertyId,
  onPropertyChange,
  className = "",
  disabled = false
}) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    loadProperties();
  }, []);

  // Close on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Keep active index valid on filter changes
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [/* deps below, filled after filtered is declared */]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/calendar/properties');
      if (res.data?.success) {
        const list = res.data.data || [];
        setProperties(list);
        if (!selectedPropertyId && list.length > 0) {
          onPropertyChange?.(list[0].id);
        }
      } else {
        setError('Failed to load properties');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const selected = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return properties;
    return properties.filter((p) =>
      [p.name, p.address, p.property_type]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(needle))
    );
  }, [properties, q]);

  // Now that `filtered` exists, fix the earlier effect's deps:
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const toggleDropdown = () => {
    if (disabled || loading) return;
    setIsOpen((v) => !v);
  };

  const selectProperty = (p) => {
    onPropertyChange?.(p.id);
    setIsOpen(false);
  };

  const onKeyDown = (e) => {
    if (disabled || loading) return;

    if (!isOpen) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => {
          listRef.current?.querySelector('input')?.focus();
        });
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[activeIndex];
      if (pick) selectProperty(pick);
    }
  };

  const scrollActiveIntoView = () => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  };

  // Loading skeleton (glassy)
  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2
        bg-white/55 backdrop-blur-xl ring-1 ring-white/50 shadow-sm animate-pulse
        dark:bg-slate-900/35 dark:ring-slate-700/60 ${className}`}>
        <div className="h-5 w-5 rounded bg-gray-300/70 dark:bg-slate-700/60" />
        <div className="h-4 w-32 rounded bg-gray-300/70 dark:bg-slate-700/60" />
        <div className="h-4 w-4 rounded bg-gray-300/70 dark:bg-slate-700/60" />
      </div>
    );
  }

  // Error state (glassy)
  if (error) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2
        bg-red-50/80 ring-1 ring-red-200/70 text-red-700 shadow-sm
        dark:bg-red-900/30 dark:ring-red-800/60 dark:text-red-200 ${className}`}>
        <Building2 className="h-5 w-5" />
        <span className="text-sm font-medium">Error loading properties</span>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      onKeyDown={onKeyDown}
    >
      {/* Trigger (glassy) */}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={toggleDropdown}
        className={`
          group inline-flex w-full max-w-[320px] items-center justify-between gap-3 rounded-xl px-3 py-2
          text-left text-sm transition
          bg-white/55 backdrop-blur-xl ring-1 ring-white/50 shadow-sm shadow-slate-900/5
          hover:bg-white/70 hover:ring-white/60 hover:shadow-md
          active:shadow-none
          dark:bg-slate-900/35 dark:ring-slate-700/60
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-400/50 dark:ring-blue-400/40' : ''}
        `}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md
          bg-white/60 ring-1 ring-white/60
          dark:bg-slate-800/60 dark:ring-slate-700/60">
          <Building2 className="h-3.5 w-3.5 opacity-80" />
        </span>

        <div className="min-w-0 grow">
          {selected ? (
            <div className="truncate font-medium text-slate-800 dark:text-slate-100">
              {selected.name}
            </div>
          ) : (
            <div className="truncate text-slate-500 dark:text-slate-400">
              Select a property
            </div>
          )}
          {selected?.address && (
            <div className="truncate text-[11px] text-slate-500/80 dark:text-slate-400/80">
              {selected.address}
            </div>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 opacity-70 transition-transform duration-150
            ${isOpen ? 'rotate-180 opacity-100' : 'group-hover:opacity-100'}`}
        />
      </button>

      {/* Popover (glassy) */}
      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Choose property"
          className="
            absolute z-50 mt-2 w-[360px] max-w-[80vw]
            rounded-2xl p-2
            bg-white/70 backdrop-blur-2xl ring-1 ring-white/60 shadow-xl shadow-slate-900/10
            dark:bg-slate-900/55 dark:ring-slate-700/70
          "
        >
          {/* Search */}
          <div className="sticky top-0 z-10 mb-2">
            <div className="flex items-center gap-2 rounded-xl px-2 py-1.5
              bg-white/75 ring-1 ring-white/60 shadow-sm
              dark:bg-slate-900/60 dark:ring-slate-700/70">
              <Search className="h-4 w-4 opacity-60" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, address, type…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-[56vh] space-y-1 overflow-auto pr-1">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No properties found
              </div>
            )}

            {filtered.map((p, i) => {
              const isSel = p.id === selectedPropertyId;
              const isActive = i === activeIndex;

              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  data-index={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectProperty(p)}
                  className={`
                    w-full rounded-xl px-3 py-2.5 text-left transition
                    bg-white/40 ring-1 ring-white/45 shadow-sm shadow-slate-900/5
                    hover:bg-white/70 hover:ring-white/60 hover:shadow-md
                    dark:bg-slate-900/35 dark:ring-slate-700/60 dark:hover:bg-slate-900/55
                    ${isActive ? 'ring-2 ring-blue-400/60 dark:ring-blue-400/40' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg
                      bg-white/60 ring-1 ring-white/60
                      dark:bg-slate-800/60 dark:ring-slate-700/60">
                      <Building2 className="h-4 w-4 opacity-80" />
                    </div>

                    <div className="min-w-0 grow">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                          {p.name}
                        </div>
                        {p.property_type && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium
                            bg-white/60 ring-1 ring-white/60 text-slate-700
                            dark:bg-slate-900/40 dark:ring-slate-700/60 dark:text-slate-200">
                            {p.property_type}
                          </span>
                        )}
                      </div>
                      {p.address && (
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {p.address}
                        </div>
                      )}
                    </div>

                    <div className="pl-2">
                      {isSel && <Check className="h-4 w-4 text-blue-500" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

PropertySelector.displayName = 'PropertySelector';
