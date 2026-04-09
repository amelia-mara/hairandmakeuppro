/**
 * Map a scene's INT/EXT + DAY/NIGHT to a scene-list card CSS class.
 *
 * Matches the colour tokens defined in script-breakdown.css. Returns
 * an empty string for any combination outside the four canonical
 * INT/EXT × DAY/NIGHT cases (e.g. DAWN, DUSK, CONTINUOUS) so callers
 * can safely interpolate the result into a className without an extra
 * fallback.
 */
export function sceneColorClass(intExt: string, dayNight: string): string {
  const isInt = intExt.toUpperCase() === 'INT';
  const isExt = intExt.toUpperCase() === 'EXT';
  const isDay = dayNight.toUpperCase() === 'DAY';
  const isNight = dayNight.toUpperCase() === 'NIGHT';

  if (isInt && isDay) return 'sl-card--int-day';
  if (isExt && isDay) return 'sl-card--ext-day';
  if (isInt && isNight) return 'sl-card--int-night';
  if (isExt && isNight) return 'sl-card--ext-night';
  return '';
}
