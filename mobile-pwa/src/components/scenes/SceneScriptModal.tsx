/**
 * SceneScriptModal - Reusable modal for viewing full scene content
 * Used when clicking on synopsis in Breakdown or Today views
 */

import { useEffect } from 'react';
import type { Scene } from '@/types';
import { clsx } from 'clsx';

interface SceneScriptModalProps {
  scene: Scene;
  onClose: () => void;
}

export function SceneScriptModal({ scene, onClose }: SceneScriptModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full flex flex-col bg-card animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border safe-top">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-semibold text-text-primary">
              Scene {scene.sceneNumber}
            </h2>
            <p className="text-xs text-text-muted truncate">
              {scene.slugline}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 text-text-muted hover:text-text-primary tap-target touch-manipulation"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scene metadata badges */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-gray-50">
          <span className={clsx(
            'px-2 py-0.5 text-xs font-bold rounded',
            scene.intExt === 'INT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          )}>
            {scene.intExt}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-text-secondary">
            {scene.timeOfDay}
          </span>
          {scene.filmingStatus && (
            <span className={clsx(
              'px-2 py-0.5 text-xs font-medium rounded',
              scene.filmingStatus === 'complete' ? 'bg-green-100 text-green-700' :
              scene.filmingStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            )}>
              {scene.filmingStatus === 'complete' ? 'Complete' :
               scene.filmingStatus === 'partial' ? 'Partial' : 'Incomplete'}
            </span>
          )}
        </div>

        {/* Synopsis section */}
        {scene.synopsis && (
          <div className="px-4 py-3 border-b border-border/50 bg-gold-100/30">
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-1">
              SYNOPSIS
            </h3>
            <p className="text-sm text-text-secondary italic">
              {scene.synopsis}
            </p>
          </div>
        )}

        {/* Script content */}
        <div className="flex-1 overflow-y-auto">
          {scene.scriptContent ? (
            <div className="p-4">
              <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
                FULL SCENE
              </h3>
              <pre className="whitespace-pre-wrap font-mono text-sm text-text-primary leading-relaxed">
                {scene.scriptContent}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">
                No Script Content
              </h3>
              <p className="text-sm text-text-muted text-center">
                Script content is not available for this scene.
                {!scene.synopsis && ' Upload a script to view full scene content.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer with close button */}
        <div className="border-t border-border p-4 safe-bottom bg-card">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-button gold-gradient text-white font-medium active:scale-[0.98] transition-transform"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SceneScriptModal;
