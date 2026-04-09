import type { Character, Scene } from '@/stores/breakdownStore';

/**
 * Right-panel view shown when the Supporting Artists tab is active.
 * Lists every supporting artist in the current scene with their notes
 * and an "Also in" line pointing at the other scenes each one appears
 * in. Read-only — supporting-artist profiles aren't editable from the
 * scene breakdown page.
 */
export function SupportingArtistsPanel({ artists, scene, allScenes }: { artists: Character[]; scene: Scene; allScenes: Scene[] }) {
  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary, #e8e0d4)' }}>
          Supporting Artists
        </h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #a89b8c)' }}>
          Background and extras in this scene
        </p>
      </div>

      {artists.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #a89b8c)', fontStyle: 'italic' }}>No supporting artists in this scene.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {artists.map((artist) => {
            const otherScenes = allScenes.filter((s) => s.id !== scene.id && s.characterIds.includes(artist.id));
            return (
              <div key={artist.id} style={{
                background: 'var(--card-bg, #2a2520)', border: '1px solid var(--border, #3d352d)',
                borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #e8e0d4)' }}>
                    {artist.name}
                  </span>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10,
                    background: 'var(--accent-muted, #78716c)', color: 'var(--text-primary, #e8e0d4)',
                  }}>
                    SA
                  </span>
                </div>
                {artist.notes && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #a89b8c)' }}>
                    {artist.notes}
                  </p>
                )}
                {otherScenes.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted, #a89b8c)' }}>
                    Also in: {otherScenes.map((s) => `Sc ${s.number}`).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
