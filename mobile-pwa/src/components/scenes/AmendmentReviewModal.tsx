/**
 * Amendment Review Modal
 *
 * Shows users a summary of script changes after uploading a revised script.
 * Allows reviewing and confirming which changes to apply while preserving
 * existing breakdown data (characters, looks, continuity photos).
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import type { AmendmentResult, SceneChange } from '@/services/scriptAmendmentService';

interface AmendmentReviewModalProps {
  amendmentResult: AmendmentResult;
  onApply: (options: {
    includeNew: boolean;
    includeModified: boolean;
    includeDeleted: boolean;
  }) => void;
  onCancel: () => void;
}

export function AmendmentReviewModal({
  amendmentResult,
  onApply,
  onCancel,
}: AmendmentReviewModalProps) {
  const [includeNew, setIncludeNew] = useState(true);
  const [includeModified, setIncludeModified] = useState(true);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  const { newScenes, modifiedScenes, deletedScenes, summary } = amendmentResult;

  const hasChanges = newScenes.length > 0 || modifiedScenes.length > 0 || deletedScenes.length > 0;

  const handleApply = () => {
    onApply({ includeNew, includeModified, includeDeleted });
  };

  const renderSceneChange = (change: SceneChange, type: 'new' | 'modified' | 'deleted') => {
    const isExpanded = expandedScene === change.sceneNumber;

    const bgColor = type === 'new'
      ? 'bg-green-50 border-green-200'
      : type === 'modified'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200';

    const textColor = type === 'new'
      ? 'text-green-700'
      : type === 'modified'
        ? 'text-amber-700'
        : 'text-red-700';

    const badgeColor = type === 'new'
      ? 'bg-green-100 text-green-700'
      : type === 'modified'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';

    const badgeText = type === 'new' ? 'NEW' : type === 'modified' ? 'MODIFIED' : 'DELETED';

    return (
      <div
        key={change.sceneNumber}
        className={clsx('border rounded-lg overflow-hidden', bgColor)}
      >
        <button
          onClick={() => setExpandedScene(isExpanded ? null : change.sceneNumber)}
          className="w-full p-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">
              Scene {change.sceneNumber}
            </span>
            <span className={clsx('px-1.5 py-0.5 text-[10px] font-bold rounded', badgeColor)}>
              {badgeText}
            </span>
          </div>
          <svg
            className={clsx('w-4 h-4 text-text-muted transition-transform', isExpanded && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 border-t border-border/30">
            <p className={clsx('text-xs mt-2', textColor)}>
              {change.changeDescription}
            </p>

            {change.contentSimilarity !== undefined && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Content similarity</span>
                  <span>{change.contentSimilarity}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      change.contentSimilarity >= 80 ? 'bg-green-500' :
                        change.contentSimilarity >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${change.contentSimilarity}%` }}
                  />
                </div>
              </div>
            )}

            {type === 'modified' && change.existingScene && (
              <div className="mt-3 p-2 bg-white/50 rounded text-xs">
                <p className="text-text-muted mb-1">Existing data preserved:</p>
                <ul className="text-text-secondary space-y-0.5">
                  {change.existingScene.characters.length > 0 && (
                    <li>- {change.existingScene.characters.length} confirmed character(s)</li>
                  )}
                  {change.existingScene.synopsis && (
                    <li>- Scene synopsis</li>
                  )}
                  {change.existingScene.filmingStatus && (
                    <li>- Filming status: {change.existingScene.filmingStatus}</li>
                  )}
                </ul>
              </div>
            )}

            {change.newScene && (
              <div className="mt-2">
                <p className="text-xs text-text-muted">Slugline:</p>
                <p className="text-xs font-medium text-text-primary">
                  {change.newScene.slugline}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[90vh] flex flex-col safe-bottom">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-text-primary">
              Script Amendment Detected
            </h3>
            <p className="text-xs text-text-muted">{summary}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 -mr-2 text-text-muted active:text-gold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasChanges ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-text-primary font-medium">No Changes Detected</p>
              <p className="text-sm text-text-muted mt-1">
                The script appears to be identical to your current breakdown.
              </p>
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Your existing breakdown data (confirmed characters, looks, continuity photos) will be preserved for modified scenes.
                </p>
              </div>

              {/* New Scenes */}
              {newScenes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold tracking-wider uppercase text-green-700">
                      New Scenes ({newScenes.length})
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeNew}
                        onChange={(e) => setIncludeNew(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-gold focus:ring-gold"
                      />
                      <span className="text-xs text-text-muted">Include</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    {newScenes.map(change => renderSceneChange(change, 'new'))}
                  </div>
                </div>
              )}

              {/* Modified Scenes */}
              {modifiedScenes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold tracking-wider uppercase text-amber-700">
                      Modified Scenes ({modifiedScenes.length})
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeModified}
                        onChange={(e) => setIncludeModified(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-gold focus:ring-gold"
                      />
                      <span className="text-xs text-text-muted">Include</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    {modifiedScenes.map(change => renderSceneChange(change, 'modified'))}
                  </div>
                </div>
              )}

              {/* Deleted Scenes */}
              {deletedScenes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold tracking-wider uppercase text-red-700">
                      Deleted Scenes ({deletedScenes.length})
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeDeleted}
                        onChange={(e) => setIncludeDeleted(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-gold focus:ring-gold"
                      />
                      <span className="text-xs text-text-muted">Mark as deleted</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    {deletedScenes.map(change => renderSceneChange(change, 'deleted'))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border shrink-0 space-y-2">
          {hasChanges ? (
            <>
              <button
                onClick={handleApply}
                disabled={!includeNew && !includeModified && !includeDeleted}
                className="w-full py-3 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Apply Selected Changes
              </button>
              <button
                onClick={onCancel}
                className="w-full py-2 text-sm text-text-muted"
              >
                Cancel - Keep Current Version
              </button>
            </>
          ) : (
            <button
              onClick={onCancel}
              className="w-full py-3 rounded-button bg-gray-100 text-text-primary font-semibold text-base active:scale-[0.98] transition-transform"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Amendment indicator badge for scene cards
 * Shows when a scene has been flagged as new/modified/deleted
 */
interface AmendmentBadgeProps {
  status: 'new' | 'modified' | 'deleted' | 'unchanged' | undefined;
  notes?: string;
  onDismiss?: () => void;
}

export function AmendmentBadge({ status, onDismiss }: AmendmentBadgeProps) {
  if (!status || status === 'unchanged') return null;

  const config = {
    new: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-200',
      label: 'NEW',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    modified: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      border: 'border-amber-200',
      label: 'AMENDED',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    },
    deleted: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-200',
      label: 'REMOVED',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  };

  const c = config[status];

  return (
    <div className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-full border', c.bg, c.border)}>
      <span className={c.text}>{c.icon}</span>
      <span className={clsx('text-[10px] font-bold', c.text)}>{c.label}</span>
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className={clsx('ml-1 hover:opacity-70', c.text)}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
