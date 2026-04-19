/**
 * DirectorQueriesSection — renders the director queries at the bottom
 * of the breakdown form panel. Separated into its own component so
 * the store import doesn't block the main panel from loading.
 */

import { useState } from 'react';
import { useDirectorQueriesStore } from '@/stores/directorQueriesStore';

interface Props {
  projectId: string;
  sceneId: string;
}

export function DirectorQueriesSection({ projectId, sceneId }: Props) {
  const store = useDirectorQueriesStore(projectId);
  const queries = store((s) => s.queries[sceneId] || []);
  const addQuery = store((s) => s.addQuery);
  const updateQuery = store((s) => s.updateQuery);
  const toggleResolved = store((s) => s.toggleResolved);
  const removeQuery = store((s) => s.removeQuery);
  const [newText, setNewText] = useState('');

  return (
    <div style={{ marginTop: '24px', padding: '0 4px' }}>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#C4522A', marginBottom: '10px',
      }}>
        Director Queries
      </div>

      {queries.map((q) => (
        <div
          key={q.id}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            padding: '8px 10px', marginBottom: '6px', borderRadius: '8px',
            backgroundColor: q.resolved ? 'rgba(74,191,176,0.08)' : 'rgba(232,98,26,0.08)',
            border: `1px solid ${q.resolved ? 'rgba(74,191,176,0.2)' : 'rgba(232,98,26,0.2)'}`,
          }}
        >
          <button
            onClick={() => toggleResolved(sceneId, q.id)}
            style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
              border: `2px solid ${q.resolved ? '#4ABFB0' : '#E8621A'}`,
              backgroundColor: q.resolved ? '#4ABFB0' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {q.resolved && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={q.text}
            onChange={(e) => updateQuery(sceneId, q.id, e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '0.8125rem', color: 'var(--text-primary)',
              textDecoration: q.resolved ? 'line-through' : 'none',
              opacity: q.resolved ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => removeQuery(sceneId, q.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '0 2px', flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newText.trim()) {
              addQuery(sceneId, newText.trim());
              setNewText('');
            }
          }}
          placeholder="Add a question for the director..."
          style={{
            flex: 1, padding: '8px 10px', borderRadius: '8px', fontSize: '0.8125rem',
            border: '1px solid rgba(232,98,26,0.25)', backgroundColor: 'rgba(232,98,26,0.04)',
            outline: 'none', color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={() => {
            if (newText.trim()) {
              addQuery(sceneId, newText.trim());
              setNewText('');
            }
          }}
          disabled={!newText.trim()}
          style={{
            padding: '8px 12px', borderRadius: '8px', border: 'none',
            backgroundColor: newText.trim() ? '#E8621A' : 'var(--bg-secondary)',
            color: newText.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: '0.75rem', fontWeight: 600, cursor: newText.trim() ? 'pointer' : 'default',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
