/**
 * Schedule Amendment Review Modal
 *
 * Shows users a summary of schedule changes after uploading a revised schedule.
 * Allows reviewing and confirming which changes to apply while preserving
 * existing schedule data where desired.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import type {
  ScheduleAmendmentResult,
  ScheduleSceneChange,
} from '@/services/scheduleAmendmentService';

interface ScheduleAmendmentModalProps {
  amendmentResult: ScheduleAmendmentResult;
  getCastNamesForNumbers: (numbers: number[]) => string[];
  onApply: (options: {
    includeAddedScenes: boolean;
    includeRemovedScenes: boolean;
    includeMovedScenes: boolean;
    includeCastChanges: boolean;
    includeTimingChanges: boolean;
  }) => void;
  onCancel: () => void;
}

export function ScheduleAmendmentModal({
  amendmentResult,
  getCastNamesForNumbers,
  onApply,
  onCancel,
}: ScheduleAmendmentModalProps) {
  const [includeAdded, setIncludeAdded] = useState(true);
  const [includeRemoved, setIncludeRemoved] = useState(true);
  const [includeMoved, setIncludeMoved] = useState(true);
  const [includeCast, setIncludeCast] = useState(true);
  const [includeTiming, setIncludeTiming] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const {
    addedScenes,
    removedScenes,
    movedScenes,
    castChanges,
    timingChanges,
    addedDays,
    removedDays,
    summary,
    hasChanges,
  } = amendmentResult;

  const handleApply = () => {
    onApply({
      includeAddedScenes: includeAdded,
      includeRemovedScenes: includeRemoved,
      includeMovedScenes: includeMoved,
      includeCastChanges: includeCast,
      includeTimingChanges: includeTiming,
    });
  };

  const anySelected = includeAdded || includeRemoved || includeMoved || includeCast || includeTiming;

  const renderChangeIcon = (type: string) => {
    switch (type) {
      case 'scene_added':
      case 'day_added':
        return (
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        );
      case 'scene_removed':
      case 'day_removed':
        return (
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </div>
        );
      case 'scene_moved':
        return (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        );
      case 'cast_changed':
        return (
          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        );
      case 'timing_changed':
        return (
          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const renderSceneChange = (change: ScheduleSceneChange) => (
    <div key={`${change.sceneNumber}-${change.changeType}`} className="flex items-start gap-2 py-2">
      {renderChangeIcon(change.changeType)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-text-primary">
            Sc {change.sceneNumber}
          </span>
          {change.newEntry && (
            <span className="text-[10px] text-text-muted truncate">
              {change.newEntry.setLocation}
            </span>
          )}
        </div>
        <p className="text-[11px] text-text-muted mt-0.5">{change.description}</p>

        {/* Cast change details */}
        {change.changeType === 'cast_changed' && (
          <div className="mt-1 space-y-0.5">
            {change.castAdded && change.castAdded.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {getCastNamesForNumbers(change.castAdded).map((name, i) => (
                  <span key={i} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    + {name}
                  </span>
                ))}
              </div>
            )}
            {change.castRemoved && change.castRemoved.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {getCastNamesForNumbers(change.castRemoved).map((name, i) => (
                  <span key={i} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                    - {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderSection = (
    title: string,
    sectionKey: string,
    changes: ScheduleSceneChange[],
    color: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    checkboxLabel: string = 'Include'
  ) => {
    if (changes.length === 0) return null;

    const isExpanded = expandedSection === sectionKey;
    const colorMap: Record<string, { heading: string; border: string; bg: string }> = {
      green: { heading: 'text-green-700', border: 'border-green-200', bg: 'bg-green-50' },
      red: { heading: 'text-red-700', border: 'border-red-200', bg: 'bg-red-50' },
      blue: { heading: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50' },
      purple: { heading: 'text-purple-700', border: 'border-purple-200', bg: 'bg-purple-50' },
      amber: { heading: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50' },
    };
    const c = colorMap[color] || colorMap.amber;

    return (
      <div className={clsx('border rounded-lg overflow-hidden', c.border)}>
        <div className={clsx('px-3 py-2', c.bg)}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpandedSection(isExpanded ? null : sectionKey)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <h4 className={clsx('text-xs font-bold tracking-wider uppercase', c.heading)}>
                {title} ({changes.length})
              </h4>
              <svg
                className={clsx('w-3.5 h-3.5 text-text-muted transition-transform', isExpanded && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-gold focus:ring-gold"
              />
              <span className="text-xs text-text-muted">{checkboxLabel}</span>
            </label>
          </div>
        </div>

        {isExpanded && (
          <div className="px-3 divide-y divide-border/30">
            {changes.map(renderSceneChange)}
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
              Schedule Changes Detected
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!hasChanges ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-text-primary font-medium">No Changes Detected</p>
              <p className="text-sm text-text-muted mt-1">
                The new schedule appears identical to your current one.
              </p>
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Select which changes to apply. Unchecked changes will be ignored and your current data will be preserved.
                </p>
              </div>

              {/* Day changes summary */}
              {(addedDays.length > 0 || removedDays.length > 0) && (
                <div className="flex gap-2">
                  {addedDays.length > 0 && (
                    <div className="flex-1 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-xs font-semibold text-green-700">
                        +{addedDays.length} day{addedDays.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {removedDays.length > 0 && (
                    <div className="flex-1 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-xs font-semibold text-red-700">
                        -{removedDays.length} day{removedDays.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Scene change sections */}
              {renderSection(
                'Scenes Added',
                'added',
                addedScenes,
                'green',
                includeAdded,
                setIncludeAdded
              )}

              {renderSection(
                'Scenes Removed',
                'removed',
                removedScenes,
                'red',
                includeRemoved,
                setIncludeRemoved,
                'Remove'
              )}

              {renderSection(
                'Scenes Moved',
                'moved',
                movedScenes,
                'blue',
                includeMoved,
                setIncludeMoved
              )}

              {renderSection(
                'Cast Changes',
                'cast',
                castChanges,
                'purple',
                includeCast,
                setIncludeCast
              )}

              {renderSection(
                'Timing Changes',
                'timing',
                timingChanges,
                'amber',
                includeTiming,
                setIncludeTiming
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
                disabled={!anySelected}
                className="w-full py-3 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Apply Selected Changes
              </button>
              <button
                onClick={onCancel}
                className="w-full py-2 text-sm text-text-muted"
              >
                Cancel - Keep Current Schedule
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
