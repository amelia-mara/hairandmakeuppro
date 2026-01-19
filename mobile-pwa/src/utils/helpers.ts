import type { Scene, SceneCapture, ContinuityFlags } from '@/types';

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a time for display
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date and time for display
 */
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Get completion status for a scene capture
 */
export type CaptureStatus = 'not-started' | 'in-progress' | 'complete';

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
 * Count active continuity flags
 */
export function countActiveFlags(flags: ContinuityFlags): number {
  return Object.values(flags).filter(Boolean).length;
}

/**
 * Parse scene range string to array of numbers
 * e.g., "12-18" -> [12, 13, 14, 15, 16, 17, 18]
 */
export function parseSceneRange(range: string): number[] {
  const scenes: number[] = [];
  const parts = range.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          scenes.push(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        scenes.push(num);
      }
    }
  }

  return [...new Set(scenes)].sort((a, b) => a - b);
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
  let startNum = parseInt(start, 10);
  let endNum = startNum;

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
      startNum = currentNum;
      endNum = currentNum;
    }
  }

  ranges.push(start === end ? start : `${start}-${end}`);
  return ranges.join(', ');
}

/**
 * Get the scene status icon type
 */
export type SceneStatusIcon = 'empty' | 'incomplete' | 'complete';

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
 * Debounce function for text inputs
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a random avatar color
 */
export function generateAvatarColor(): string {
  const colors = [
    '#C9A962', // Gold
    '#5B8DEF', // Blue
    '#7B68EE', // Purple
    '#4CAF50', // Green
    '#FF7043', // Orange
    '#EC407A', // Pink
    '#26A69A', // Teal
    '#AB47BC', // Violet
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Check if device is iOS
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Check if app is running as installed PWA
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Format estimated time for display
 */
export function formatEstimatedTime(minutes: number): string {
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
 * Get ordinal suffix for number
 */
export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format date as short format: "Mon 15 Jan"
 * Used for calendar/schedule displays
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}
