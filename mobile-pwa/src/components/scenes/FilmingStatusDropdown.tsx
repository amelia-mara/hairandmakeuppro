/**
 * FilmingStatusDropdown — set status dropdown for scene cards.
 * Extracted from Scenes.tsx so it can be reused in the merged Breakdown page.
 */

import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import type { Scene, SceneFilmingStatus } from '@/types';
import { SCENE_FILMING_STATUS_CONFIG } from '@/types';

interface FilmingStatusDropdownProps {
  scene: Scene;
  onStatusChange: (sceneNumber: string, status: SceneFilmingStatus, notes?: string) => void;
  onNotesModalOpen: (sceneNumber: string, status: 'partial' | 'not-filmed') => void;
}

export function FilmingStatusDropdown({ scene, onStatusChange, onNotesModalOpen }: FilmingStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentConfig = scene.filmingStatus
    ? SCENE_FILMING_STATUS_CONFIG[scene.filmingStatus]
    : null;

  const handleStatusSelect = (status: SceneFilmingStatus) => {
    setIsOpen(false);
    if (status === 'complete') {
      onStatusChange(scene.sceneNumber, status);
    } else {
      onNotesModalOpen(scene.sceneNumber, status);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold rounded-lg flex-shrink-0 border transition-colors',
          currentConfig ? [
            currentConfig.bgClass,
            currentConfig.textClass,
            scene.filmingStatus === 'complete' && 'border-green-200',
            scene.filmingStatus === 'partial' && 'border-amber-200',
            scene.filmingStatus === 'not-filmed' && 'border-red-200'
          ] : 'bg-gray-100 text-text-muted border-gray-200 hover:border-gray-300'
        )}
      >
        {currentConfig ? (
          <>
            <span className={clsx(
              'w-2 h-2 rounded-full',
              scene.filmingStatus === 'complete' && 'bg-green-500',
              scene.filmingStatus === 'partial' && 'bg-amber-500',
              scene.filmingStatus === 'not-filmed' && 'bg-red-500'
            )} />
            {currentConfig.shortLabel}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Set Status
          </>
        )}
        <svg className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-border overflow-hidden min-w-[140px]">
          {(['complete', 'partial', 'not-filmed'] as SceneFilmingStatus[]).map((status) => {
            const config = SCENE_FILMING_STATUS_CONFIG[status];
            const isSelected = scene.filmingStatus === status;
            return (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusSelect(status);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left',
                  isSelected ? `${config.bgClass} ${config.textClass}` : 'hover:bg-gray-50 text-text-primary'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                {config.label}
                {isSelected && (
                  <svg className="w-3.5 h-3.5 ml-auto text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FilmingNotesModalProps {
  sceneNumber: string;
  status: 'partial' | 'not-filmed';
  onConfirm: (notes: string) => void;
  onClose: () => void;
}

export function FilmingNotesModal({ sceneNumber, status, onConfirm, onClose }: FilmingNotesModalProps) {
  const [notes, setNotes] = useState('');
  const config = SCENE_FILMING_STATUS_CONFIG[status];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
            <h2 className="text-lg font-semibold text-text-primary">
              Scene {sceneNumber} - {config.label}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {status === 'partial' ? 'What still needs to be filmed?' : 'Why wasn\'t this scene filmed?'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Ran out of time, weather issues, actor unavailable..."
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
              rows={4}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-button border border-border text-text-muted text-sm font-medium">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(notes)}
              className={clsx('flex-1 py-2.5 rounded-button text-white text-sm font-medium', status === 'partial' ? 'bg-amber-500' : 'bg-red-500')}
            >
              Mark as {config.label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
