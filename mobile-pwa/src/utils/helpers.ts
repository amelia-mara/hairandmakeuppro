import type { Scene, SceneCapture } from '@/types';

/**
 * Get completion status for a scene capture
 */
type CaptureStatus = 'not-started' | 'in-progress' | 'complete';

export function getCaptureStatus(capture?: SceneCapture): CaptureStatus {
  if (!capture) return 'not-started';

  const hasPhotos = capture.photos.front || capture.photos.left ||
                    capture.photos.right || capture.photos.back ||
                    capture.additionalPhotos.length > 0;

  if (!hasPhotos) return 'not-started';

  // Consider complete if at least front photo is captured
  if (capture.photos.front) return 'complete';

  return 'in-progress';
}

/**
 * Format scene range from array of scene numbers
 * e.g., ['1', '2', '3', '5', '6', '10'] -> "1-3, 5-6, 10"
 * For alphanumeric scenes like '4A', just lists them
 */
export function formatSceneRange(scenes: string[]): string {
  if (scenes.length === 0) return '';
  if (scenes.length === 1) return scenes[0];

  // Sort numerically where possible
  const sorted = [...scenes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Try to form ranges for purely numeric scenes
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  let endNum = parseInt(start, 10);

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const currentNum = parseInt(current, 10);

    // Only form ranges if both are simple integers and consecutive
    if (!isNaN(endNum) && !isNaN(currentNum) &&
        current === String(currentNum) && end === String(endNum) &&
        currentNum === endNum + 1) {
      end = current;
      endNum = currentNum;
    } else {
      ranges.push(start === end ? start : `${start}-${end}`);
      start = current;
      end = current;
      endNum = currentNum;
    }
  }

  ranges.push(start === end ? start : `${start}-${end}`);
  return ranges.join(', ');
}

/**
 * Get the scene status icon type
 */
type SceneStatusIcon = 'empty' | 'incomplete' | 'complete';

export function getSceneStatusIcon(scene: Scene, captures: Record<string, SceneCapture>): SceneStatusIcon {
  if (scene.isComplete) return 'complete';

  // Check if any capture exists for this scene
  const hasCaptures = scene.characters.some(charId => {
    const capture = captures[`${scene.id}-${charId}`];
    return capture && getCaptureStatus(capture) !== 'not-started';
  });

  return hasCaptures ? 'incomplete' : 'empty';
}

/**
 * Format estimated time for display
 */
export function formatEstimatedTime(minutes: number): string {
  if (minutes <= 0) {
    return '~0 min';
  }
  if (minutes < 60) {
    return `~${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `~${hours}h`;
  }
  return `~${hours}h ${mins}m`;
}

/**
 * Format date as short format: "Mon 15 Jan"
 * Used for calendar/schedule displays
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}
