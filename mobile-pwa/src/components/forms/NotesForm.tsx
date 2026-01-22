import { useState, useEffect, useRef } from 'react';
import { Textarea } from '../ui';

interface NotesFormProps {
  notes: string;
  onChange: (notes: string) => void;
}

export function NotesForm({ notes, onChange }: NotesFormProps) {
  const [localNotes, setLocalNotes] = useState(notes);
  const pendingValueRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync with external changes
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  // Flush any pending debounced changes
  const flush = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingValueRef.current !== null) {
      onChangeRef.current(pendingValueRef.current);
      pendingValueRef.current = null;
    }
  };

  // Flush on unmount
  useEffect(() => {
    return () => {
      flush();
    };
  }, []);

  const handleChange = (value: string) => {
    setLocalNotes(value);
    pendingValueRef.current = value;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced save (reduced to 300ms)
    timeoutRef.current = setTimeout(() => {
      if (pendingValueRef.current !== null) {
        onChangeRef.current(pendingValueRef.current);
        pendingValueRef.current = null;
      }
    }, 300);
  };

  // Also save on blur for immediate feedback
  const handleBlur = () => {
    flush();
  };

  return (
    <Textarea
      value={localNotes}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      placeholder="Add continuity notes, anomalies, director requests..."
      rows={4}
      className="resize-none"
    />
  );
}
