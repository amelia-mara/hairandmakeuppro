export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidProjectName(name: string): string | null {
  if (!name.trim()) return 'Project name is required';
  if (name.length > 100) return 'Project name must be under 100 characters';
  return null;
}

export function isValidNumber(value: string): boolean {
  return !isNaN(Number(value)) && value.trim().length > 0;
}

export function isPositiveNumber(value: number): boolean {
  return !isNaN(value) && value > 0;
}
