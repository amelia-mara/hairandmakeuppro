export type ProjectType =
  | 'Feature Film'
  | 'TV Series'
  | 'Commercial'
  | 'Music Video'
  | 'Short Film';

export const PROJECT_TYPES: ProjectType[] = [
  'Feature Film',
  'TV Series',
  'Commercial',
  'Music Video',
  'Short Film',
];

/** Supabase JSON column type */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
