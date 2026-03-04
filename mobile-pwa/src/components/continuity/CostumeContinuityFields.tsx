import { useState, useCallback } from 'react';
import type { CostumeContinuityData, CostumeChecklistItem } from '@/config/department';

interface CostumeContinuityFieldsProps {
  data: CostumeContinuityData;
  onChange: (data: CostumeContinuityData) => void;
}

export function CostumeContinuityFields({ data, onChange }: CostumeContinuityFieldsProps) {
  const [newItemText, setNewItemText] = useState('');

  const updateField = useCallback(<K extends keyof CostumeContinuityData>(
    field: K,
    value: CostumeContinuityData[K]
  ) => {
    onChange({ ...data, [field]: value });
  }, [data, onChange]);

  const addCostumeItem = () => {
    if (!newItemText.trim()) return;
    const newItem: CostumeChecklistItem = {
      id: `item-${Date.now()}`,
      label: newItemText.trim(),
      checked: true,
      note: '',
    };
    updateField('costumeItems', [...data.costumeItems, newItem]);
    setNewItemText('');
  };

  const toggleItem = (id: string) => {
    updateField(
      'costumeItems',
      data.costumeItems.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const updateItemNote = (id: string, note: string) => {
    updateField(
      'costumeItems',
      data.costumeItems.map(item =>
        item.id === id ? { ...item, note } : item
      )
    );
  };

  const removeItem = (id: string) => {
    updateField(
      'costumeItems',
      data.costumeItems.filter(item => item.id !== id)
    );
  };

  return (
    <div className="space-y-4">
      {/* Costume Items Checklist */}
      <div>
        <h3 className="section-header mb-2">COSTUME ITEMS</h3>
        <div className="space-y-1.5">
          {data.costumeItems.map(item => (
            <div key={item.id} className="flex items-start gap-2 bg-card rounded-lg p-2.5 border border-border">
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  item.checked
                    ? 'bg-gold border-gold'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {item.checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${item.checked ? 'text-text-primary' : 'text-text-secondary line-through'}`}>
                  {item.label}
                </span>
                <input
                  type="text"
                  className="w-full text-xs text-text-secondary bg-transparent border-0 border-b border-border/50 mt-1 px-0 py-0.5 focus:outline-none focus:border-gold placeholder:text-text-tertiary"
                  placeholder="Add note..."
                  value={item.note || ''}
                  onChange={(e) => updateItemNote(item.id, e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-text-tertiary hover:text-red-500 transition-colors mt-0.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add new item */}
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 text-sm bg-card border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-gold placeholder:text-text-tertiary"
              placeholder="Add costume item..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCostumeItem()}
            />
            <button
              type="button"
              onClick={addCostumeItem}
              disabled={!newItemText.trim()}
              className="px-3 py-2 rounded-lg bg-gold text-white text-sm font-medium disabled:opacity-40 transition-opacity"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Text fields */}
      <TextFieldRow label="Shoes" value={data.shoes} onChange={(v) => updateField('shoes', v)} placeholder="e.g., Brown leather brogues, size 10" />
      <TextFieldRow label="Jewellery" value={data.jewellery} onChange={(v) => updateField('jewellery', v)} placeholder="e.g., Gold wedding band, silver watch" />
      <TextFieldRow label="Accessories" value={data.accessories} onChange={(v) => updateField('accessories', v)} placeholder="e.g., Brown leather belt, sunglasses" />
      <TextFieldRow label="Hair Pieces/Wigs" value={data.hairPiecesWigs} onChange={(v) => updateField('hairPiecesWigs', v)} placeholder="e.g., Lace front wig #3 (crossover with H&MU)" />

      {/* Continuity Notes */}
      <div>
        <label className="field-label block mb-1.5">Continuity Notes</label>
        <textarea
          className="w-full text-sm bg-card border border-border rounded-lg px-3 py-2 min-h-[80px] resize-y focus:outline-none focus:border-gold placeholder:text-text-tertiary"
          placeholder="Any continuity notes for this scene..."
          value={data.continuityNotes}
          onChange={(e) => updateField('continuityNotes', e.target.value)}
        />
      </div>

      {/* Scene Change Toggle */}
      <div>
        <label className="field-label block mb-2">Scene Change</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => updateField('sceneChange', 'same')}
            className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              data.sceneChange === 'same'
                ? 'border-gold bg-gold-50 text-gold'
                : 'border-border bg-card text-text-secondary'
            }`}
          >
            Same as Previous
          </button>
          <button
            type="button"
            onClick={() => updateField('sceneChange', 'change')}
            className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              data.sceneChange === 'change'
                ? 'border-gold bg-gold-50 text-gold'
                : 'border-border bg-card text-text-secondary'
            }`}
          >
            Costume Change
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable single-line text field
function TextFieldRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label block mb-1.5">{label}</label>
      <input
        type="text"
        className="w-full text-sm bg-card border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-gold placeholder:text-text-tertiary"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
