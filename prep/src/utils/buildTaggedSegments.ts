import type { ScriptTag } from '@/stores/breakdownStore';

/**
 * Split a script text into contiguous segments based on overlapping tag
 * offsets, returning each segment with the list of tags that cover it.
 *
 * Used by the script viewer to render highlighted spans where tags
 * overlap. The output is a flat array of `[start, end)` ranges that
 * collectively cover `[0, text.length)` with no gaps and no overlaps;
 * each segment carries every tag whose `[startOffset, endOffset)` range
 * intersects it, so multi-tag spans (e.g. a hair tag that overlaps a
 * makeup tag) get rendered with stacked highlights.
 *
 * If no tags are supplied, returns a single empty-tags segment covering
 * the entire text.
 */
export function buildTaggedSegments(
  text: string,
  tags: ScriptTag[],
): { start: number; end: number; tags: ScriptTag[] }[] {
  if (tags.length === 0) return [{ start: 0, end: text.length, tags: [] }];

  // Collect all unique boundary points from tag start/end offsets
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);
  for (const t of tags) {
    boundaries.add(Math.max(0, t.startOffset));
    boundaries.add(Math.min(text.length, t.endOffset));
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  // Build segments between each pair of boundary points, collecting all tags that overlap
  const segs: { start: number; end: number; tags: ScriptTag[] }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;
    const overlapping = tags.filter((t) => t.startOffset < end && t.endOffset > start);
    segs.push({ start, end, tags: overlapping });
  }
  return segs;
}
