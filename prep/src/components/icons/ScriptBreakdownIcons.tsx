/**
 * SVG icon set used by the prep ScriptBreakdown page (the Tools dropdown
 * and its child menu items) and by BreakdownSheet.tsx (the Export CSV /
 * Export PDF buttons).
 *
 * These are inline SVG components — no props, fixed 14×14 size, stroke
 * inherits via `currentColor`. They were originally defined inline at
 * the bottom of `prep/src/pages/ScriptBreakdown.tsx` and moved here so
 * the page file is shorter and the icons can be reused.
 *
 * Arrow convention (standard, matches Lucide / Feather / Tabler):
 *   - ImportIcon: DOWN arrow ending at the tray opening = download / import into
 *   - ExportIcon: UP   arrow rising out of the tray opening = upload / export from
 *
 * Both icons share the same tray path (a U-shape opening upward, walls
 * topping at y=15, bottom at y=21). Only the polyline (chevron) and the
 * vertical shaft differ between them.
 *
 * NOTE — Budget icons are NOT consolidated with this file:
 *   `prep/src/components/budget/BudgetTabs.tsx` and
 *   `prep/src/components/budget/BudgetTopBar.tsx` define their own
 *   ImportIcon / ExportIcon under the same names. Those files use
 *   strokeWidth="1.5" instead of "2", and (after this PR) they happen
 *   to use the SAME arrow directions as the icons here — so future
 *   consolidation is now safe in principle, but it's still a separate
 *   visual change because of the stroke-width difference. A follow-up
 *   pass should either pick one stroke weight for the whole prep app
 *   or accept the discrepancy and migrate the Budget files to import
 *   from this file with a strokeWidth prop. Not done in this PR to
 *   keep the change scope tight.
 */

export function ToolsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}

export function ImportIcon() {
  // Down arrow ending at the tray opening — standard "download / import into" visual.
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}

export function DraftsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/></svg>;
}

export function BreakdownViewIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>;
}

export function ExportIcon() {
  // Up arrow rising out of the tray opening — standard "upload / export from" visual.
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
