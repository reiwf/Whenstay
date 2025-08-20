import React, { useEffect, useMemo, useRef, useState } from "react";

export default function TimePicker({
  value: controlledValue,
  onChange,
  format = "24",            // "24" | "12"
  step = 15,                // minutes
  min,                      // "HH:mm" same-day window (ignored if overnightRange is set)
  max,
  placeholder = "HH:mm",
  disabled = false,
  clearable = true,
  overnightRange,           // { start: "HH:mm", end: "HH:mm" } supports wrap (e < s)
  className = "",           // to apply .form-field
  error = false,            // to add .error class
}) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(null);
  const value = isControlled ? controlledValue : uncontrolledValue;

  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [filterText, setFilterText] = useState("");
  const [displayText, setDisplayText] = useState("");

  const inputRef = useRef(null);
  const popRef = useRef(null);

  // ---------- time helpers ----------
  const parse24 = (str) => {
    if (!str || typeof str !== "string") return null;
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
  };

  const to24 = (str) => {
    if (!str) return null;
    if (format === "24") return parse24(str);
    const m = str.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!m) return parse24(str); // allow passing "HH:mm"
    let h = Number(m[1]);
    const mm = Number(m[2]);
    const ap = m[3].toUpperCase();
    if (h === 12) h = 0;
    if (ap === "PM") h += 12;
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return h * 60 + mm;
  };

  const fmt24 = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const fmt12 = (mins) => {
    let h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const am = h24 < 12;
    let h = h24 % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
  };

  const toDisplay = (mins) => (format === "24" ? fmt24(mins) : fmt12(mins));

  // ---------- options builder (with overnight support) ----------
  const options = useMemo(() => {
    const out = [];
    const DAY = 24 * 60;

    const startFrom = (mins) => ((Math.ceil(mins / step) * step) % DAY);

    const pushRange = (from, to) => {
      // inclusive range, no wrap
      for (let m = startFrom(from); m <= to; m += step) {
        const label = toDisplay(m);
        out.push({ value: fmt24(m), label, mins: m, key: `${m}` });
      }
    };

    if (overnightRange?.start && overnightRange?.end) {
      const s = parse24(overnightRange.start);
      const e = parse24(overnightRange.end);
      if (s == null || e == null) return out;

      if (e < s) {
        // e.g., 16:00 -> 03:00
        pushRange(s, DAY - 1);
        pushRange(0, e);
      } else {
        pushRange(s, e);
      }
      return out;
    }

    // same-day min/max
    const minMins = min ? parse24(min) : 0;
    const maxMins = max ? parse24(max) : DAY - 1;
    pushRange(minMins ?? 0, maxMins ?? DAY - 1);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, format, min, max, overnightRange?.start, overnightRange?.end]);

  // filter list by typed text
  const filtered = useMemo(() => {
    if (!filterText.trim()) return options;
    const f = filterText.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(f));
  }, [filterText, options]);

  // manage highlight
  useEffect(() => {
    setHighlightIndex(filtered.length ? 0 : -1);
  }, [open, filterText, options.length]); // eslint-disable-line

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // sync input text when value/format changes
  useEffect(() => {
    const vMins = to24(value);
    setDisplayText(vMins != null ? toDisplay(vMins) : "");
  }, [value, format]); // eslint-disable-line

  // ---------- handlers ----------
  const commitChange = (vStr /* "HH:mm" */) => {
    const next = format === "24" ? vStr : toDisplay(parse24(vStr));
    if (onChange) onChange(next);
    if (!isControlled) setUncontrolledValue(next);
    setOpen(false);
    setFilterText("");
  };

  const handleInputChange = (e) => {
    const t = e.target.value;
    setDisplayText(t);
    setFilterText(t);
    if (!open) setOpen(true);
  };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => clamp(i + 1, 0, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => clamp(i - 1, 0, filtered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlightIndex];
      if (opt) commitChange(opt.value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const clear = (e) => {
    e.stopPropagation();
    if (onChange) onChange(null);
    if (!isControlled) setUncontrolledValue(null);
    setDisplayText("");
    setFilterText("");
  };

  // ---------- render ----------
  return (
    <div className="tp-root" style={{ position: "relative", width: "100%" }}>
      <div
        className={`form-field ${disabled ? "disabled" : ""} ${error ? "error" : ""} ${className}`}
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
          aria-controls="tp-listbox"
           style={{
          width: "100%",
          padding: "8px 16px",
          outline: "none",
          boxShadow: "none",
          background: disabled ? "#f5f5f5" : "white",
        }}
        />

        {/* format badge */}
        <span
          title="Format"
          aria-hidden
          style={{
            marginRight: 8,
            fontSize: 11,
            color: "#6b7280",
            background: "#f3f4f6",
            borderRadius: 6,
            padding: "2px 6px",
            whiteSpace: "nowrap",
          }}
        >
          {format === "24" ? "24h" : "12h"}
        </span>

        {/* clear button */}
        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={clear}
            title="Clear"
            aria-label="Clear time"
            style={{
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              paddingRight: 10,
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div
            ref={popRef}
            role="listbox"
            id="tp-listbox"
            tabIndex={-1}
            className="tp-pop"
            style={{
                position: "absolute",
                zIndex: 50,
                bottom: "calc(100% + 6px)",
                left: 0,
                width: "100%",
                maxHeight: 260,
                overflow: "hidden",
            }}
            onMouseDown={(e) => e.preventDefault()}
            >
          {filtered.length === 0 ? (
            <div style={{ padding: 10, fontSize: 13, color: "#6b7280" }}>No matches</div>
          ) : (
            <div style={{ overflowY: "auto", maxHeight: 260 }}>
              {filtered.map((opt, idx) => {
                const selected = value && to24(value) === opt.mins;
                const highlighted = idx === highlightIndex;
                return (
                  <div
                    key={opt.key}
                    role="option"
                    tabIndex={-1}           // don't show outline
                    className={[
                        "tp-item",
                        selected ? "tp-selected" : "",
                        highlighted ? "tp-highlight" : ""
                    ].join(" ").trim()}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => commitChange(opt.value)}
                    style={{ padding: "8px 10px", fontSize: 14, cursor: "pointer" }}
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
