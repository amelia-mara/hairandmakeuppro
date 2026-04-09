import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  useBreakdownStore,
  useTagStore,
  useParsedScriptStore,
  useRevisedScenesStore,
  type Character,
  type Scene,
  type ScriptTag,
  type ParsedCharacterData,
} from '@/stores/breakdownStore';
import { type TagPopupState, ScriptTagPopup } from './ScriptTagPopup';
import {
  buildCharNamePattern,
  highlightCharacterNames,
  renderSceneContent,
} from './renderSceneContent';

/**
 * Center-panel continuous script viewer with inline tagging.
 *
 * Renders every scene as a "paper" block in a vertically scrolling
 * container. Supports:
 *   - Character cue and dialogue line styling
 *   - Inline character-name highlighting (clickable → switches to
 *     character tab)
 *   - Text selection → 3-step tag popup (character → field/category →
 *     tag created) portalled to document.body
 *   - Tag overlay spans with stacked underlines for multi-tag segments
 *   - Scroll-to-scene on selection from the scene list
 *   - Scroll observer that reports the most-visible scene back to the
 *     parent (drives the active scene in the left panel)
 *   - Revised-scene class for visual highlighting
 */
export function ScriptView({ scenes, preambleScene, characters, selectedSceneId, scrollTrigger, onSceneVisible, fontSize, onCharClick, onTagCreated, onSynopsisTag, projectId }: {
  scenes: Scene[];
  preambleScene?: Scene;
  characters: Character[];
  selectedSceneId: string;
  scrollTrigger: number;
  onSceneVisible: (id: string) => void;
  fontSize: number;
  onCharClick: (id: string) => void;
  onTagCreated: (sceneId: string, characterId: string, categoryId: string, text: string) => void;
  onSynopsisTag: (sceneId: string, text: string) => void;
  projectId: string;
}) {
  const charNames = characters.map((c) => c.name);
  const cueNameToChar = useMemo(() => {
    const map = new Map<string, Character>();
    for (const c of characters) {
      map.set(c.name, c);
      for (const part of c.name.split(/\s+/)) {
        if (part.length >= 2 && !map.has(part)) {
          map.set(part, c);
        }
      }
    }
    return map;
  }, [characters]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingTo = useRef(false);
  const tagStore = useTagStore();
  const projectRevisions = useRevisedScenesStore((state) => state.revisions[projectId]);
  const [popup, setPopup] = useState<TagPopupState | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  /* Close popup on outside click */
  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popup]);

  /* Clamp popup within viewport after render */
  useEffect(() => {
    if (!popup || !popupRef.current) return;
    const el = popupRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 10;
    let needsUpdate = false;
    let newY = popup.y;
    let newX = popup.x;
    let newPopBelow = popup.popBelow;

    if (rect.top < pad) {
      newY = pad;
      newPopBelow = true;
      needsUpdate = true;
    } else if (rect.bottom > window.innerHeight - pad) {
      newY = window.innerHeight - rect.height - pad;
      newPopBelow = false;
      needsUpdate = true;
    }
    if (rect.left < pad) {
      newX = popup.x + (pad - rect.left);
      needsUpdate = true;
    } else if (rect.right > window.innerWidth - pad) {
      newX = popup.x - (rect.right - window.innerWidth + pad);
      needsUpdate = true;
    }

    if (needsUpdate) {
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
      el.style.transform = newPopBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    }
  }, [popup]);

  /* Handle text selection on the script paper */
  const handleMouseUp = useCallback((sceneId: string) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = sel.toString().trim();
    if (!text) return;

    const range = sel.getRangeAt(0);
    const paper = pageRefs.current.get(sceneId);
    if (!paper) return;

    const contentEl = paper.querySelector('.sv-content');
    if (!contentEl) return;

    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const scriptText = scene.scriptContent;

    const computeOffset = (container: Element, node: Node, offset: number): number => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let charCount = 0;
      let current: Text | null;
      while ((current = walker.nextNode() as Text | null)) {
        if (current === node) return charCount + offset;
        charCount += current.textContent?.length || 0;
      }
      return -1;
    };

    const domOffset = computeOffset(contentEl, range.startContainer, range.startOffset);
    let startIdx: number;
    if (domOffset >= 0) {
      const searchStart = Math.max(0, domOffset - 20);
      const nearbyIdx = scriptText.indexOf(text, searchStart);
      startIdx = nearbyIdx !== -1 ? nearbyIdx : scriptText.indexOf(text);
    } else {
      startIdx = scriptText.indexOf(text);
    }
    if (startIdx === -1) return;

    const rect = range.getBoundingClientRect();
    const estPopupHeight = 350;
    const popBelow = rect.top < estPopupHeight + 20;
    let y = popBelow ? rect.bottom + 10 : rect.top - 10;
    if (popBelow && y + estPopupHeight > window.innerHeight - 10) {
      y = window.innerHeight - estPopupHeight - 10;
    }
    if (!popBelow && y - estPopupHeight < 10) {
      y = estPopupHeight + 10;
    }

    setPopup({
      x: Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170),
      y,
      sceneId,
      startOffset: startIdx,
      endOffset: startIdx + text.length,
      text,
      step: 'character',
      popBelow,
    });

    sel.removeAllRanges();
  }, [scenes]);

  const parsedScriptStore = useParsedScriptStore();

  /* Tag popup handlers */
  const handleCharacterPick = useCallback((charId: string) => {
    if (!popup) return;
    setPopup({ ...popup, step: 'field', characterId: charId });
  }, [popup]);

  const handleCreateNewCharacter = useCallback(() => {
    if (!popup) return;
    const pd = parsedScriptStore.getParsedData(projectId);
    if (!pd) return;
    const newId = crypto.randomUUID();
    const newChar: ParsedCharacterData = {
      id: newId,
      name: popup.text.trim().toUpperCase(),
      billing: pd.characters.length + 1,
      category: 'principal',
      age: '', gender: '', hairColour: '', hairType: '',
      eyeColour: '', skinTone: '', build: '', distinguishingFeatures: '', notes: '',
    };
    const updatedChars = [...pd.characters, newChar];
    const updatedScenes = pd.scenes.map(s =>
      s.id === popup.sceneId ? { ...s, characterIds: [...s.characterIds, newId] } : s
    );
    parsedScriptStore.setParsedData(projectId, { ...pd, characters: updatedChars, scenes: updatedScenes });
    const bd = useBreakdownStore.getState().getBreakdown(popup.sceneId);
    if (bd && !bd.characters.some(c => c.characterId === newId)) {
      useBreakdownStore.getState().setBreakdown(popup.sceneId, {
        ...bd,
        characters: [...bd.characters, {
          characterId: newId, lookId: '',
          entersWith: { hair: '', makeup: '', wardrobe: '' },
          sfx: '', environmental: '', action: '',
          changeType: 'no-change' as const, changeNotes: '',
          exitsWith: { hair: '', makeup: '', wardrobe: '' },
          notes: '',
        }],
      });
    }
    setPopup({ ...popup, step: 'field', characterId: newId });
  }, [popup, parsedScriptStore, projectId]);

  const handleAddCharacterToScene = useCallback(() => {
    if (!popup || !popup.characterId) return;
    const pd = parsedScriptStore.getParsedData(projectId);
    if (!pd) return;
    const scene = pd.scenes.find(s => s.id === popup.sceneId);
    if (!scene) return;
    if (!scene.characterIds.includes(popup.characterId)) {
      const updatedScenes = pd.scenes.map(s =>
        s.id === popup.sceneId ? { ...s, characterIds: [...s.characterIds, popup.characterId!] } : s
      );
      parsedScriptStore.setParsedData(projectId, { ...pd, scenes: updatedScenes });
    }
    const bd = useBreakdownStore.getState().getBreakdown(popup.sceneId);
    if (bd && !bd.characters.some(c => c.characterId === popup.characterId)) {
      useBreakdownStore.getState().setBreakdown(popup.sceneId, {
        ...bd,
        characters: [...bd.characters, {
          characterId: popup.characterId, lookId: '',
          entersWith: { hair: '', makeup: '', wardrobe: '' },
          sfx: '', environmental: '', action: '',
          changeType: 'no-change' as const, changeNotes: '',
          exitsWith: { hair: '', makeup: '', wardrobe: '' },
          notes: '',
        }],
      });
    }
    tagStore.addTag({
      id: `tag-${Date.now()}`,
      sceneId: popup.sceneId,
      startOffset: popup.startOffset,
      endOffset: popup.endOffset,
      text: popup.text,
      categoryId: 'cast',
      characterId: popup.characterId,
    });
    setPopup(null);
  }, [popup, parsedScriptStore, projectId, tagStore]);

  const handleFieldPick = useCallback((catId: string) => {
    if (!popup || !popup.characterId) return;
    tagStore.addTag({
      id: `tag-${Date.now()}`,
      sceneId: popup.sceneId,
      startOffset: popup.startOffset,
      endOffset: popup.endOffset,
      text: popup.text,
      categoryId: catId,
      characterId: popup.characterId,
    });
    onTagCreated(popup.sceneId, popup.characterId, catId, popup.text);
    setPopup(null);
  }, [popup, tagStore, onTagCreated]);

  const handleSynopsisPick = useCallback(() => {
    if (!popup) return;
    tagStore.addTag({
      id: `tag-${Date.now()}`,
      sceneId: popup.sceneId,
      startOffset: popup.startOffset,
      endOffset: popup.endOffset,
      text: popup.text,
      categoryId: 'synopsis',
      characterId: '',
    });
    onSynopsisTag(popup.sceneId, popup.text);
    setPopup(null);
  }, [popup, tagStore, onSynopsisTag]);

  const handleEditChangeCategory = useCallback((tagId: string, newCatId: string) => {
    tagStore.updateTag(tagId, { categoryId: newCatId });
    setPopup(null);
  }, [tagStore]);

  const handleEditDeleteTag = useCallback((tagId: string) => {
    tagStore.removeTag(tagId);
    if (popup?.editingTagIds && popup.editingTagIds.length > 1) {
      setPopup({
        ...popup,
        editingTagIds: popup.editingTagIds.filter(id => id !== tagId),
      });
    } else {
      setPopup(null);
    }
  }, [tagStore, popup]);

  const handleTagClick = useCallback((e: React.MouseEvent, sceneId: string, tagIds: string[]) => {
    e.stopPropagation();
    const foundTags = tagIds.map(id => tagStore.tags.find(t => t.id === id)).filter(Boolean) as ScriptTag[];
    if (foundTags.length === 0) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const estPopupHeight = 300;
    const popBelow = rect.top < estPopupHeight + 20;
    let y = popBelow ? rect.bottom + 10 : rect.top - 10;
    if (popBelow && y + estPopupHeight > window.innerHeight - 10) {
      y = window.innerHeight - estPopupHeight - 10;
    }
    if (!popBelow && y - estPopupHeight < 10) {
      y = estPopupHeight + 10;
    }
    setPopup({
      x: Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170),
      y,
      sceneId,
      startOffset: foundTags[0].startOffset,
      endOffset: foundTags[0].endOffset,
      text: foundTags[0].text,
      step: 'edit',
      popBelow,
      editingTagIds: tagIds,
    });
  }, [tagStore]);

  /* Character name highlighting pipeline — delegates to extracted helpers */
  const charNamePattern = useMemo(() => buildCharNamePattern(characters), [characters]);

  const highlightCharNames = useCallback(
    (text: string, keyPrefix: string) => highlightCharacterNames(text, keyPrefix, charNamePattern, onCharClick),
    [charNamePattern, onCharClick],
  );

  const renderPreambleContent = useCallback((scene: Scene) => {
    const lines = scene.scriptContent.split('\n');
    let titleFound = false;
    return lines.map((line, i) => {
      const trimmed = line.trim();
      const isTitle = !titleFound && trimmed !== '';
      if (isTitle) titleFound = true;
      return (
        <div key={`pre-${i}`} className={`sv-line${isTitle ? ' sv-preamble-title' : ''}`}>
          {trimmed || '\u00A0'}
        </div>
      );
    });
  }, []);

  const memoRenderSceneContent = useCallback((scene: Scene) => {
    const sceneTags = tagStore.getTagsForScene(scene.id);
    return renderSceneContent({
      scene,
      charNames,
      cueNameToChar,
      characters,
      onCharClick,
      highlightCharNames,
      handleTagClick,
      sceneTags,
    });
  }, [tagStore, charNames, cueNameToChar, characters, onCharClick, highlightCharNames, handleTagClick]);

  /* Scroll to scene when selected from the scene list */
  useEffect(() => {
    const el = pageRefs.current.get(selectedSceneId);
    if (el && scrollRef.current) {
      isScrollingTo.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const container = scrollRef.current;
      const unlock = () => { isScrollingTo.current = false; };
      let timer: ReturnType<typeof setTimeout>;
      if (container && 'onscrollend' in container) {
        const handler = () => { unlock(); container.removeEventListener('scrollend', handler); clearTimeout(timer); };
        container.addEventListener('scrollend', handler, { once: true });
        timer = setTimeout(handler, 1500);
      } else {
        timer = setTimeout(unlock, 1200);
      }
      return () => { clearTimeout(timer); unlock(); };
    }
  }, [selectedSceneId, scrollTrigger]);

  /* Detect which scene is most visible while scrolling */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (isScrollingTo.current) return;
        const containerRect = container.getBoundingClientRect();
        const zoneTop = containerRect.top;
        const zoneBottom = containerRect.top + containerRect.height * 0.4;

        let bestId: string | null = null;
        let bestOverlap = 0;

        for (const [id, el] of pageRefs.current.entries()) {
          const r = el.getBoundingClientRect();
          const overlapTop = Math.max(r.top, zoneTop);
          const overlapBottom = Math.min(r.bottom, zoneBottom);
          const overlap = Math.max(0, overlapBottom - overlapTop);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestId = id;
          }
        }
        if (bestId) onSceneVisible(bestId);
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { container.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId); };
  }, [scenes, onSceneVisible]);

  const setPageRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(id, el);
    else pageRefs.current.delete(id);
  }, []);

  return (
    <div className="sv-scroll" ref={scrollRef} style={{ position: 'relative' }}>
      {scenes.map((scene, idx) => (
        <div
          key={scene.id}
          ref={(el) => setPageRef(scene.id, el)}
          data-scene-id={scene.id}
          className={`sv-paper ${scene.id === selectedSceneId ? 'sv-paper--active' : ''} ${projectRevisions && projectRevisions.changes.some((c) => c.sceneId === scene.id) && !projectRevisions.reviewedSceneIds.includes(scene.id) ? 'sv-paper--revised' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
          onMouseUp={() => handleMouseUp(scene.id)}
        >
          {idx === 0 && preambleScene && (
            <div className="sv-content sv-preamble-content">
              {renderPreambleContent(preambleScene)}
            </div>
          )}
          <div className="sv-heading">{scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}</div>
          <div className="sv-content">
            {memoRenderSceneContent(scene)}
          </div>
        </div>
      ))}

      <ScriptTagPopup
        popup={popup}
        popupRef={popupRef}
        characters={characters}
        scenes={scenes}
        tags={tagStore.tags}
        onCharacterPick={handleCharacterPick}
        onCreateNewCharacter={handleCreateNewCharacter}
        onAddCharacterToScene={handleAddCharacterToScene}
        onFieldPick={handleFieldPick}
        onSynopsisPick={handleSynopsisPick}
        onEditChangeCategory={handleEditChangeCategory}
        onEditDeleteTag={handleEditDeleteTag}
        onBack={() => popup && setPopup({ ...popup, step: 'character' })}
      />
    </div>
  );
}
