-- Migration: Add 'deviation' to photos.photo_type check constraint
-- This enables floor-team deviation photos to be stored alongside regular
-- continuity photos using the existing photos table.

-- Drop the existing check constraint and recreate with the new value.
-- The constraint name follows the pattern used by the initial schema.
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_photo_type_check;
ALTER TABLE photos ADD CONSTRAINT photos_photo_type_check
  CHECK (photo_type IN ('reference', 'on_set', 'wrap', 'deviation'));
