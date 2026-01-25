import { useState } from 'react';
import { BottomSheet } from '@/components/ui/Modal';
import type { PermissionLevel } from '@/types';
import { PERMISSION_LEVELS } from '@/types';

interface PermissionPickerProps {
  label: string;
  value: PermissionLevel;
  onChange: (value: PermissionLevel) => void;
  disabled?: boolean;
}

export function PermissionPicker({
  label,
  value,
  onChange,
  disabled = false,
}: PermissionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = PERMISSION_LEVELS.find((p) => p.value === value)?.label || value;

  return (
    <>
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`w-full card flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] transition-transform'
        }`}
      >
        <div className="text-left">
          <p className="text-sm font-medium text-text-primary">{label}</p>
          <p className="text-xs text-text-muted">{currentLabel}</p>
        </div>
        <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={label}
      >
        <div className="space-y-2">
          {PERMISSION_LEVELS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                value === option.value
                  ? 'bg-gold-50 border border-gold'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  value === option.value ? 'text-gold' : 'text-text-primary'
                }`}
              >
                {option.label}
              </span>
              {value === option.value && (
                <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

interface StatusPickerProps {
  value: 'prep' | 'shooting' | 'wrapped';
  onChange: (value: 'prep' | 'shooting' | 'wrapped') => void;
  disabled?: boolean;
}

const STATUS_OPTIONS: { value: 'prep' | 'shooting' | 'wrapped'; label: string; icon: React.ReactNode }[] = [
  {
    value: 'prep',
    label: 'Prep',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'shooting',
    label: 'Shooting',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: 'wrapped',
    label: 'Wrapped',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function StatusPicker({ value, onChange, disabled = false }: StatusPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = STATUS_OPTIONS.find((s) => s.value === value);

  return (
    <>
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`w-full card flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] transition-transform'
        }`}
      >
        <div className="text-left">
          <p className="text-sm font-medium text-text-primary">Project Status</p>
          <p className="text-xs text-text-muted">{currentOption?.label}</p>
        </div>
        <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Project Status"
      >
        <div className="space-y-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 rounded-xl text-left flex items-center gap-3 transition-colors ${
                value === option.value
                  ? 'bg-gold-50 border border-gold'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div
                className={`${
                  value === option.value ? 'text-gold' : 'text-text-muted'
                }`}
              >
                {option.icon}
              </div>
              <span
                className={`flex-1 text-sm font-medium ${
                  value === option.value ? 'text-gold' : 'text-text-primary'
                }`}
              >
                {option.label}
              </span>
              {value === option.value && (
                <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

interface ProductionTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const PRODUCTION_TYPE_OPTIONS = [
  { value: 'film', label: 'Feature Film' },
  { value: 'tv_series', label: 'TV Series' },
  { value: 'short_film', label: 'Short Film' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'theatre', label: 'Theatre' },
  { value: 'other', label: 'Other' },
];

export function ProductionTypeSelector({ value, onChange, disabled = false }: ProductionTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = PRODUCTION_TYPE_OPTIONS.find((p) => p.value === value)?.label || value;

  return (
    <>
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`w-full card flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] transition-transform'
        }`}
      >
        <div className="text-left">
          <p className="text-sm font-medium text-text-primary">Production Type</p>
          <p className="text-xs text-text-muted">{currentLabel}</p>
        </div>
        <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Production Type"
      >
        <div className="space-y-2">
          {PRODUCTION_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                value === option.value
                  ? 'bg-gold-50 border border-gold'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  value === option.value ? 'text-gold' : 'text-text-primary'
                }`}
              >
                {option.label}
              </span>
              {value === option.value && (
                <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
