import { useState, useCallback, useEffect } from 'react';
import {
  X,
  Film,
  Tv,
  Clapperboard,
  Music,
  Video,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { PROJECT_TYPES, type ProjectType } from '@/types';

const TYPE_ICONS: Record<ProjectType, typeof Film> = {
  'Feature Film': Film,
  'TV Series': Tv,
  'Commercial': Clapperboard,
  'Music Video': Music,
  'Short Film': Video,
};

interface CreateProjectModalProps {
  onComplete: (projectId: string) => void;
  onCancel: () => void;
}

export function CreateProjectModal({ onComplete, onCancel }: CreateProjectModalProps) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const addProject = useProjectStore((s) => s.addProject);

  const canCreate = title.trim() && projectType;

  const createProject = useCallback(() => {
    if (!canCreate) return;
    const id = `project-${Date.now()}`;
    addProject({
      id,
      title: title.trim(),
      genre: genre.trim(),
      type: projectType,
      status: 'setup',
      progress: 0,
      lastActive: new Date().toISOString(),
      scenes: 0,
      characters: 0,
      createdAt: new Date().toISOString(),
    });
    onComplete(id);
  }, [title, genre, projectType, canCreate, addProject, onComplete]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-glass"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 28px 0',
        }}>
          <h2 style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color: 'var(--text-heading)',
            margin: 0,
          }}>
            New Project
          </h2>
          <button
            onClick={onCancel}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'var(--border-medium)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Title */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}>
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Deadline"
              className="input-field"
              style={{ padding: '11px 14px', fontSize: '0.875rem' }}
              autoFocus
            />
          </div>

          {/* Genre */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}>
              Genre
              <span style={{
                fontSize: '0.625rem',
                padding: '1px 6px',
                borderRadius: '999px',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}>
                Optional
              </span>
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="e.g. Thriller, Comedy, Drama"
              className="input-field"
              style={{ padding: '11px 14px', fontSize: '0.875rem' }}
            />
          </div>

          {/* Type selector */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '10px',
            }}>
              Production Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {PROJECT_TYPES.map((type) => {
                const Icon = TYPE_ICONS[type];
                const selected = projectType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setProjectType(type)}
                    className={`type-card${selected ? ' type-card--selected' : ''}`}
                  >
                    <Icon size={20} style={{ color: selected ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: selected ? 'var(--accent-gold)' : 'var(--text-label)',
                    }}>
                      {type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 24px',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              background: 'none',
              border: '1px solid var(--border-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-medium)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-card)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={createProject}
            disabled={!canCreate}
            className="btn-gold"
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              opacity: canCreate ? 1 : 0.4,
              cursor: canCreate ? 'pointer' : 'not-allowed',
            }}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
