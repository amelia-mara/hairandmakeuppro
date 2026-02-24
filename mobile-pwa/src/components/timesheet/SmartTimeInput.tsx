import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Parse shorthand time input into HH:MM format.
 *
 * Supports:
 *   "9"     → "09:00"
 *   "17"    → "17:00"
 *   "930"   → "09:30"
 *   "1730"  → "17:30"
 *   "9:30"  → "09:30"
 *   "9am"   → "09:00"
 *   "530pm" → "17:30"
 *   "5:30p" → "17:30"
 *   ""      → ""
 */
export function parseTimeShorthand(input: string): string {
  if (!input) return '';

  let str = input.trim().toLowerCase();

  // Detect am/pm suffix
  let isPM = false;
  let isAM = false;

  if (/p\.?m\.?$/.test(str) || /p$/.test(str)) {
    isPM = true;
    str = str.replace(/p\.?m\.?$|p$/, '').trim();
  } else if (/a\.?m\.?$/.test(str) || /a$/.test(str)) {
    isAM = true;
    str = str.replace(/a\.?m\.?$|a$/, '').trim();
  }

  let hours: number;
  let minutes: number;

  if (str.includes(':')) {
    // Colon format: "9:30", "17:30", "5:00"
    const parts = str.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1] || '0', 10);
  } else {
    // Pure numeric shorthand
    const digits = str.replace(/\D/g, '');
    if (!digits) return '';

    if (digits.length <= 2) {
      // 1–2 digits: hours only → "9" = 09:00, "17" = 17:00
      hours = parseInt(digits, 10);
      minutes = 0;
    } else if (digits.length === 3) {
      // 3 digits: H + MM → "930" = 9:30, "130" = 1:30
      hours = parseInt(digits[0], 10);
      minutes = parseInt(digits.slice(1), 10);
    } else if (digits.length === 4) {
      // 4 digits: HH + MM → "0930" = 09:30, "1730" = 17:30
      hours = parseInt(digits.slice(0, 2), 10);
      minutes = parseInt(digits.slice(2), 10);
    } else {
      return '';
    }
  }

  // Apply AM/PM
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  // Validate
  if (isNaN(hours) || isNaN(minutes)) return '';
  if (hours < 0 || hours > 23) return '';
  if (minutes < 0 || minutes > 59) return '';

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Generate time slots from 05:00 to 23:30 in 30-min intervals
const TIME_SLOTS: string[] = [];
for (let h = 5; h <= 23; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 23 || true) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
  }
}

function formatSlotLabel(slot: string): string {
  const [hStr, mStr] = slot.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr}${suffix}`;
}

interface SmartTimeInputProps {
  value: string;
  onChange: (formattedTime: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SmartTimeInput({ value, onChange, placeholder, className, style }: SmartTimeInputProps) {
  const [displayValue, setDisplayValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync from parent when not focused (e.g. auto-fill from call sheet)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value || '');
    }
  }, [value, isFocused]);

  // Scroll to current value when dropdown opens
  useEffect(() => {
    if (showDropdown && listRef.current && value) {
      const idx = TIME_SLOTS.indexOf(value);
      if (idx >= 0) {
        const item = listRef.current.children[idx] as HTMLElement;
        item?.scrollIntoView({ block: 'center' });
      }
    }
  }, [showDropdown, value]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const commitValue = useCallback(() => {
    const formatted = parseTimeShorthand(displayValue);
    setDisplayValue(formatted);
    if (formatted !== value) {
      onChange(formatted);
    }
  }, [displayValue, value, onChange]);

  const handleBlur = () => {
    setIsFocused(false);
    commitValue();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleSelectSlot = (slot: string) => {
    setDisplayValue(slot);
    onChange(slot);
    setShowDropdown(false);
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={() => { setIsFocused(true); setShowDropdown(false); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || '00:00'}
        className={className}
        style={{ ...style, flex: 1 }}
      />
      {/* 24hr badge + clock button */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span
          className="text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded"
          style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          24hr
        </span>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setShowDropdown(!showDropdown); }}
          className="p-0.5 rounded"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Pick time"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
      </div>

      {/* Time dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 z-50 rounded-lg shadow-lg overflow-y-auto"
          style={{
            top: '100%',
            marginTop: 4,
            maxHeight: 200,
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          {TIME_SLOTS.map((slot) => {
            const isSelected = slot === value;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => handleSelectSlot(slot)}
                className={`w-full px-3 py-2 text-left text-[13px] flex justify-between items-center ${
                  isSelected ? 'font-bold' : ''
                }`}
                style={{
                  backgroundColor: isSelected ? 'var(--color-input-bg)' : 'transparent',
                  color: isSelected ? 'var(--color-gold)' : 'var(--color-text-primary)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span className="font-mono">{slot}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                  {formatSlotLabel(slot)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
