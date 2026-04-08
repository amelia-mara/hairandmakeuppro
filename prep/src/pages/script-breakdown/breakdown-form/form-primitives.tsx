/**
 * Thin form primitives shared by the breakdown form panel and
 * character block. Each wraps a labelled input/select in the standard
 * `fi-wrap` / `fi-label` / `fi-input` classes so the page stays
 * visually consistent without every call site repeating the markup.
 */

export function FInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="fi-wrap">
      <label className="fi-label">{label}</label>
      <input className="fi-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function FSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="fi-wrap">
      <label className="fi-label">{label}</label>
      <select className="fi-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );
}
