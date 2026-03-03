import { v4 as uuid } from 'uuid';

export function generateId(): string {
  return uuid();
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${weeks}w ago`;
}

export function formatCurrency(amount: number, currency: string = '£'): string {
  return `${currency}${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getCompletionStatus(
  breakdowns: Record<string, { isComplete: boolean; characters: Record<string, unknown> }>,
  sceneId: string
): 'empty' | 'partial' | 'complete' {
  const bd = breakdowns[sceneId];
  if (!bd) return 'empty';
  if (bd.isComplete) return 'complete';
  if (Object.keys(bd.characters).length > 0) return 'partial';
  return 'empty';
}
