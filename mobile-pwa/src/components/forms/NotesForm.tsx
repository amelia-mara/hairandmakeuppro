import { useCallback, useState, useEffect } from 'react';
import { Textarea } from '../ui';
import { debounce } from '@/utils/helpers';

interface NotesFormProps {
  notes: string;
  onChange: (notes: string) => void;
}

export function NotesForm({ notes, onChange }: NotesFormProps) {
  const [localNotes, setLocalNotes] = useState(notes);

  // Sync with external changes
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  // Debounced save
  const debouncedOnChange = useCallback(
    debounce((value: string) => {
      onChange(value);
    }, 500),
    [onChange]
  );

  const handleChange = (value: string) => {
    setLocalNotes(value);
    debouncedOnChange(value);
  };

  return (
    <Textarea
      value={localNotes}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Add continuity notes, anomalies, director requests..."
      rows={4}
      className="resize-none"
    />
  );
}
