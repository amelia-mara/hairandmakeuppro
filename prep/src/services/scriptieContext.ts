/**
 * Scriptie context builder — assembles a snapshot of the active
 * project's data for the chat assistant's system prompt.
 *
 * Lean port of the mobile chatSystemPrompt + chatDataService: we
 * skip the elaborate query router and instead let the LLM work
 * against a structured summary of the project. Big lists are
 * capped so the prompt stays under a sensible token budget.
 */

import { useProjectStore } from '@/stores/projectStore';
import {
  useBreakdownStore,
  useParsedScriptStore,
  useSynopsisStore,
} from '@/stores/breakdownStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useBudgetStore, CURRENCY_SYMBOLS } from '@/stores/budgetStore';

const MAX_SCENES_IN_PROMPT = 60;
const MAX_CHARACTERS_IN_PROMPT = 30;
const MAX_LOOKS_IN_PROMPT = 30;

export interface ScriptieContext {
  prompt: string;
}

/**
 * Build a system prompt for the given project. Pulls live data
 * straight from the zustand stores — every send-message call gets
 * a fresh snapshot.
 */
export function buildScriptieContext(projectId: string): ScriptieContext {
  const project = useProjectStore.getState().getProject(projectId);
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  const breakdownStore = useBreakdownStore.getState();
  const synopsisStore = useSynopsisStore.getState();
  const scheduleStore = useScheduleStore(projectId).getState();
  const budgetStore = useBudgetStore(projectId).getState();

  const scenes = parsed?.scenes ?? [];
  const characters = parsed?.characters ?? [];
  const looks = parsed?.looks ?? [];
  const schedule = scheduleStore.current;

  const sortedScenes = [...scenes].sort((a, b) => a.number - b.number);
  const trimmedScenes = sortedScenes.slice(0, MAX_SCENES_IN_PROMPT);
  const trimmedChars = [...characters]
    .sort((a, b) => a.billing - b.billing)
    .slice(0, MAX_CHARACTERS_IN_PROMPT);
  const trimmedLooks = looks.slice(0, MAX_LOOKS_IN_PROMPT);

  // Per-scene synopsis + breakdown summary (only if non-empty so
  // the prompt isn't padded with placeholders).
  const sceneLines = trimmedScenes.map((s) => {
    const synopsis = synopsisStore.getSynopsis(s.id, '');
    const bd = breakdownStore.getBreakdown(s.id);
    const charsHere = s.characterIds
      .map((cid) => characters.find((c) => c.id === cid)?.name)
      .filter(Boolean)
      .join(', ');
    const day = bd?.timeline.day || s.storyDay || '';
    const omit = s.location === 'OMITTED' ? ' [OMITTED]' : '';
    const synSnippet = synopsis ? ` — "${synopsis.slice(0, 80)}"` : '';
    return `  - Sc${s.number} ${s.intExt}. ${s.location} (${s.dayNight})${day ? ` D:${day}` : ''}${charsHere ? ` · cast: ${charsHere}` : ''}${omit}${synSnippet}`;
  });

  const charLines = trimmedChars.map((c) => {
    const charLookCount = looks.filter((l) => l.characterId === c.id).length;
    const sceneCount = scenes.filter((s) => s.characterIds.includes(c.id)).length;
    const billing = c.billing ? `${c.billing}${ord(c.billing)} bill` : '';
    return `  - ${c.name}${billing ? ` (${billing})` : ''} · ${sceneCount} scenes · ${charLookCount} looks`;
  });

  const lookLines = trimmedLooks.map((l) => {
    const ch = characters.find((c) => c.id === l.characterId);
    const fields: string[] = [];
    if (l.hair) fields.push(`hair: ${l.hair.slice(0, 50)}`);
    if (l.makeup) fields.push(`makeup: ${l.makeup.slice(0, 50)}`);
    if (l.wardrobe) fields.push(`wardrobe: ${l.wardrobe.slice(0, 50)}`);
    return `  - "${l.name}" (${ch?.name ?? '?'})${fields.length ? ` — ${fields.join('; ')}` : ''}`;
  });

  // Schedule summary
  let scheduleBlock = '';
  if (schedule) {
    const days = schedule.days.length;
    const totalScenes = schedule.days.reduce((sum, d) => sum + d.scenes.length, 0);
    scheduleBlock = `\nSCHEDULE:\n- ${days} shoot days, ${totalScenes} scenes scheduled\n- Production: ${schedule.productionName ?? '—'}`;
  }

  // Budget summary
  const totalBudget = budgetStore.getTotalBudget();
  const totalSpent = budgetStore.getTotalSpent();
  const productionBudget = budgetStore.projectInfo?.budgetLimit ?? 0;
  const sym = CURRENCY_SYMBOLS[budgetStore.currency] || '£';
  const budgetBlock = productionBudget > 0 || totalSpent > 0 || totalBudget > 0
    ? `\nBUDGET:\n- Approved: ${sym}${(productionBudget > 0 ? productionBudget : totalBudget).toFixed(0)}\n- Spent: ${sym}${totalSpent.toFixed(0)} across ${budgetStore.expenses.length} receipts`
    : '';

  const projectName = project?.title || 'Untitled Project';
  const projectType = project?.type || 'production';

  const prompt = `You are Scriptie, the Checks Happy AI assistant for the hair and makeup department working on "${projectName}".

You answer questions about THIS project's script, characters, looks, scene breakdowns, schedule, and budget — citing real numbers from the data below.

PROJECT
- Name: ${projectName}
- Type: ${projectType}
- Scenes: ${scenes.length}
- Characters: ${characters.length}
- Looks defined: ${looks.length}

SCENES${scenes.length > MAX_SCENES_IN_PROMPT ? ` (first ${MAX_SCENES_IN_PROMPT} of ${scenes.length})` : ''}:
${sceneLines.join('\n') || '  (none parsed yet — script not uploaded)'}

CHARACTERS${characters.length > MAX_CHARACTERS_IN_PROMPT ? ` (first ${MAX_CHARACTERS_IN_PROMPT} of ${characters.length})` : ''}:
${charLines.join('\n') || '  (none)'}

LOOKS${looks.length > MAX_LOOKS_IN_PROMPT ? ` (first ${MAX_LOOKS_IN_PROMPT} of ${looks.length})` : ''}:
${lookLines.join('\n') || '  (none defined)'}${scheduleBlock}${budgetBlock}

HOW TO ANSWER
- Be direct and concise — designers are usually consulting you mid-prep.
- Cite specific scene numbers, character names, look names.
- Use bullet lists when listing multiple items.
- Use **bold** for headings inside an answer; \`backticks\` for scene/look IDs.
- If the data doesn't include what was asked (e.g. continuity events not yet captured, no schedule uploaded), say so plainly.
- Don't invent data — only report what's in the snapshot above.
- Don't answer questions about other productions or unrelated topics.`;

  return { prompt };
}

function ord(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}
