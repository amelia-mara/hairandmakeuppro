export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export function loadFromStorage<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return null;
  }
}

export function removeFromStorage(key: string): void {
  localStorage.removeItem(key);
}

export function clearAllStorage(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('prep-happy'));
  keys.forEach((k) => localStorage.removeItem(k));
}
