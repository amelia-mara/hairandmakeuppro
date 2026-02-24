import { useState, useEffect, useCallback } from 'react';

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

  // Sync from parent when not focused (e.g. auto-fill from call sheet)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value || '');
    }
  }, [value, isFocused]);

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

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      onBlur={handleBlur}
      onFocus={() => setIsFocused(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder || 'HH:MM'}
      className={className}
      style={style}
    />
  );
}
