import { useState, useRef, useEffect } from 'react';
import type { BudgetCategory } from '@/stores/budgetStore';

interface CopyToDropdownProps {
  categories: BudgetCategory[];
  currentCategoryId: string;
  onCopy: (toCategoryId: string) => void;
}

export function CopyToDropdown({ categories, currentCategoryId, onCopy }: CopyToDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const otherCategories = categories.filter(c => c.id !== currentCategoryId);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className="budget-icon-btn"
        onClick={() => setOpen(!open)}
        title="Copy to category"
      >
        <CopyIcon />
      </button>
      {open && (
        <div className="budget-copy-dropdown">
          <div className="budget-copy-dropdown-title">Copy to...</div>
          {otherCategories.map(cat => (
            <button
              key={cat.id}
              className="budget-copy-dropdown-item"
              onClick={() => {
                onCopy(cat.id);
                setOpen(false);
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
