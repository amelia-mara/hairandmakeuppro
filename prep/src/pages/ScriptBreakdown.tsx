import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, BREAKDOWN_CATEGORIES,
  getBreakdownCategoriesForDepartment,
  useBreakdownStore, useSynopsisStore, useScriptUploadStore, useParsedScriptStore,
  useCharacterOverridesStore, useRevisedScenesStore,
  type Scene, type Character, type Look,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import { EmbeddedBreakdownTable } from './BreakdownSheet';
import { type DiffResult } from '@/utils/scriptDiff';
import { usePanelResize } from '@/hooks/usePanelResize';
import { useScriptDrafts } from '@/hooks/useScriptDrafts';
import { SupportingArtistsPanel } from './script-breakdown/SupportingArtistsPanel';
import { ChangesSummaryModal } from './script-breakdown/modals/ChangesSummaryModal';
import { ScriptUploadModal } from './script-breakdown/modals/ScriptUploadModal';
import { DraftPdfViewer } from './script-breakdown/DraftPdfViewer';
import { ToolsMenu } from './script-breakdown/ToolsMenu';
import { SceneListPanel } from './script-breakdown/SceneListPanel';
import { BreakdownFormPanel } from './script-breakdown/breakdown-form/BreakdownFormPanel';
import { CharacterView } from './script-breakdown/character-view/CharacterView';
import { ScriptView } from './script-breakdown/script-view/ScriptView';
import { ExportPreviewModal } from '@/components/ExportPreviewModal';
import type { ExportPreview } from '@/utils/export/common';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCRIPT BREAKDOWN PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface Props { projectId: string }

const RIGHT_DEFAULT = 400;
const RIGHT_MIN = 300;
const RIGHT_MAX = 560;

export function ScriptBreakdown({ projectId }: Props) {
  const [selectedSceneId, setSelectedSceneId] = useState('s1');
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('script');
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [showLegend, setShowLegend] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);

  const rightPanel = usePanelResize('prep-right-panel-w', RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX, 'right');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const store = useBreakdownStore();
  const synopsisStore = useSynopsisStore();
  const project = useProjectStore((s) => s.getProject(projectId));
  const department = (project?.department as 'hmu' | 'costume') || 'hmu';
  const departmentCategories = useMemo(() => getBreakdownCategoriesForDepartment(department), [department]);

  /* Script upload state */
  const scriptUpload = useScriptUploadStore();
  const parsedScriptStore = useParsedScriptStore();
  const updateProject = useProjectStore((s) => s.updateProject);
  const hasScript = !!scriptUpload.getScript(projectId);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState<DiffResult | null>(null);
  const [splitView, setSplitView] = useState(false);
  const revisedStore = useRevisedScenesStore();

  /* Drafts drawer + auto-recover flow — lazy fetch, load draft,
     sign PDF preview URL, and recover parsed data from script_uploads
     when the local store is empty. All owned by this hook. */
  const {
    drafts,
    draftsLoading,
    draftsExpanded,
    setDraftsExpanded,
    loadingDraftId,
    handleLoadDraft,
    handleViewDraftPdf,
    handleDeleteDraft,
    viewingDraftPdf,
    setViewingDraftPdf,
  } = useScriptDrafts({
    projectId,
    isToolsMenuOpen: toolsOpen,
    onCloseToolsMenu: () => setToolsOpen(false),
  });

  /* Resolve data source: parsed script → mock data fallback */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const ALL_SCENES: Scene[] = useMemo(() => {
    const scenes = parsedData ? parsedData.scenes : MOCK_SCENES;
    return [...scenes].sort((a, b) =>
      String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
    );
  }, [parsedData]);
  const ALL_CHARACTERS: Character[] = useMemo(() => {
    if (!parsedData) return MOCK_CHARACTERS;
    // Backfill category for data saved before the supporting_artist feature
    return parsedData.characters.map((c) => ({
      ...c,
      category: c.category || 'principal',
    }));
  }, [parsedData]);
  const ALL_LOOKS: Look[] = useMemo(() => parsedData ? parsedData.looks : MOCK_LOOKS, [parsedData]);

  /* Hide preamble from scene list — its content is merged into the first real scene */
  const preambleScene = ALL_SCENES.find(s => s.location === 'PREAMBLE');
  const nonPreambleScenes = useMemo(() => ALL_SCENES.filter(s => s.location !== 'PREAMBLE'), [ALL_SCENES]);

  /* Auto-show upload modal when no script is uploaded */
  useEffect(() => {
    if (!hasScript && !parsedData) {
      setShowUploadModal(true);
    }
  }, [hasScript, parsedData]);

  /* Reset selected scene when data source changes — synchronous derivation
     avoids a render frame where scene is undefined */
  const validSceneId = nonPreambleScenes.find(s => s.id === selectedSceneId) ? selectedSceneId : nonPreambleScenes[0]?.id ?? '';
  useEffect(() => {
    if (validSceneId !== selectedSceneId) {
      setSelectedSceneId(validSceneId);
      setActiveTab('script'); // reset to script tab when data source changes
    }
  }, [validSceneId, selectedSceneId]);

  const scene = ALL_SCENES.find((s) => s.id === validSceneId);
  // Sort the scene's characters by billing ascending — leads (1st)
  // first, then 2nd, 3rd, etc. — so the chip row and the per-character
  // blocks below mirror the project's overall billing order rather than
  // the parser's discovery order. Characters without a billing (or 0)
  // sink to the end so principal leads are always at the top.
  const sceneCharacters = scene
    ? scene.characterIds
        .map((id) => ALL_CHARACTERS.find((c) => c.id === id))
        .filter((c): c is Character => !!c)
        .sort((a, b) => {
          const ba = a.billing && a.billing > 0 ? a.billing : Number.POSITIVE_INFINITY;
          const bb = b.billing && b.billing > 0 ? b.billing : Number.POSITIVE_INFINITY;
          return ba - bb;
        })
    : [];
  const scenePrincipals = sceneCharacters.filter((c) => c.category !== 'supporting_artist');
  const sceneSupportingArtists = sceneCharacters.filter((c) => c.category === 'supporting_artist');
  const breakdown = store.getBreakdown(validSceneId);

  useEffect(() => {
    if (!scene) return;
    const existing = store.getBreakdown(validSceneId);
    if (!existing) {
      store.setBreakdown(validSceneId, {
        sceneId: validSceneId,
        timeline: { day: scene.storyDay || '', time: scene.dayNight === 'DAY' ? 'Day' : scene.dayNight === 'NIGHT' ? 'Night' : scene.dayNight === 'DAWN' ? 'Dawn' : scene.dayNight === 'DUSK' ? 'Dusk' : '', type: '', note: '' },
        characters: scene.characterIds.map((cid) => ({
          characterId: cid, lookId: '',
          entersWith: { hair: '', makeup: '', wardrobe: '' },
          sfx: '', environmental: '', action: '',
          changeType: 'no-change', changeNotes: '',
          exitsWith: { hair: '', makeup: '', wardrobe: '' },
          notes: '',
        })),
        continuityEvents: [],
      });
    } else if (!existing.timeline.day && scene.storyDay) {
      // Backfill story day for breakdowns created before auto-population
      store.updateTimeline(validSceneId, { ...existing.timeline, day: scene.storyDay });
    }
  }, [validSceneId, store, scene]);

  const triggerSave = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, []);

  const filteredScenes = nonPreambleScenes.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (s.location.toLowerCase().includes(q) || String(s.number).includes(q)) return true;
    if (s.scriptContent.toLowerCase().includes(q)) return true;
    const charNames = s.characterIds.map((cid) => ALL_CHARACTERS.find((c) => c.id === cid)?.name ?? '').join(' ').toLowerCase();
    return charNames.includes(q);
  });

  const selectScene = useCallback((id: string) => {
    setSelectedSceneId(id);
    setScrollTrigger(n => n + 1);
    setActiveTab('script');
  }, []);

  /* Auto-select first matching scene when search query changes */
  useEffect(() => {
    if (searchQuery && filteredScenes.length > 0 && !filteredScenes.some((s) => s.id === selectedSceneId)) {
      selectScene(filteredScenes[0].id);
    }
  }, [searchQuery, filteredScenes, selectedSceneId, selectScene]);

  /* Called by IntersectionObserver as user scrolls through script */
  const onSceneVisible = useCallback((id: string) => {
    setSelectedSceneId(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const idx = filteredScenes.findIndex((s) => s.id === selectedSceneId);
      if ((e.key === 'ArrowDown' || e.key === 'j') && idx < filteredScenes.length - 1) {
        e.preventDefault(); selectScene(filteredScenes[idx + 1].id);
      } else if ((e.key === 'ArrowUp' || e.key === 'k') && idx > 0) {
        e.preventDefault(); selectScene(filteredScenes[idx - 1].id);
      } else if (e.key === 'n') {
        const next = filteredScenes.find((s, i) => i > idx && store.getCompletionStatus(s.id, s) !== 'complete');
        if (next) selectScene(next.id);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); triggerSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredScenes, selectedSceneId, selectScene, store, triggerSave]);

  return (
    <div className="bd-page">
      {/* Three panels with draggable dividers */}
      <div className={`bd-panels`}>

        {/* ━━━ LEFT — Scene List Panel ━━━ */}
        <SceneListPanel
          totalSceneCount={nonPreambleScenes.length}
          filteredScenes={filteredScenes}
          allCharacters={ALL_CHARACTERS}
          selectedSceneId={selectedSceneId}
          onSelectScene={selectScene}
          projectId={projectId}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onShowRevisions={() => {
            // Re-open the changes modal from the revised-scenes store
            // so the user can revisit the flagged list any time, not
            // just on first upload. The store keeps changes around
            // until the user has reviewed each one.
            const rev = revisedStore.revisions[projectId];
            if (!rev || rev.changes.length === 0) return;
            const stats = rev.changes.reduce(
              (acc, c) => {
                if (c.changeType === 'modified') acc.modified++;
                else if (c.changeType === 'added') acc.added++;
                else if (c.changeType === 'omitted') acc.omitted++;
                return acc;
              },
              { modified: 0, added: 0, omitted: 0, unchanged: 0 },
            );
            setShowChangesModal({
              changes: rev.changes,
              stats,
              idMap: new Map<string, string>(),
              characterIdMap: new Map<string, string>(),
            });
          }}
        />

        {/* ━━━ CENTER — Script / Characters ━━━ */}
        <div className="bd-center">
          {/* File divider tabs */}
          <div className="cp-tabstrip">
            <div className="cp-tabs-row">
              <button className={`cp-divider-tab ${activeTab === 'script' ? 'cp-divider-tab--active' : ''}`}
                onClick={() => setActiveTab('script')}>Script</button>
              {scenePrincipals.map((c) => (
                <button key={c.id} className={`cp-divider-tab ${activeTab === c.id ? 'cp-divider-tab--active' : ''}`}
                  onClick={() => setActiveTab(c.id)}>{c.name}</button>
              ))}
              {/* Show tab for active character even if not in this scene */}
              {activeTab !== 'script' && activeTab !== 'supporting-artists' && !scenePrincipals.find(c => c.id === activeTab) && ALL_CHARACTERS.find(c => c.id === activeTab) && (
                <button className="cp-divider-tab cp-divider-tab--active"
                  onClick={() => setActiveTab(activeTab)}>{ALL_CHARACTERS.find(c => c.id === activeTab)!.name}</button>
              )}
              {sceneSupportingArtists.length > 0 && (
                <button className={`cp-divider-tab ${activeTab === 'supporting-artists' ? 'cp-divider-tab--active' : ''}`}
                  onClick={() => setActiveTab('supporting-artists')}
                  style={{ fontStyle: 'italic', opacity: 0.85 }}>
                  Supporting Artists ({sceneSupportingArtists.length})
                </button>
              )}
            </div>
          </div>
          {/* Compact toolbar — Tags toggle only */}
          <div className="cp-toolbar">
            <button className={`bd-tags-toggle ${showLegend ? 'bd-tags-toggle--active' : ''}`} onClick={() => setShowLegend((v) => !v)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              Tags
            </button>
            {showLegend && (
              <div className="bd-legend-tags">
                {departmentCategories.map((cat) => (
                  <span key={cat.id} className="bd-legend-tag">
                    <span className="bd-legend-swatch" style={{ background: cat.color }} />
                    {cat.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Content body — connects to active tab */}
          <div className="cp-body">
            {activeTab === 'script' ? (
              <div className="sv-wrapper">
                <ScriptView
                  scenes={nonPreambleScenes}
                  preambleScene={preambleScene}
                  characters={ALL_CHARACTERS}
                  selectedSceneId={selectedSceneId}
                  scrollTrigger={scrollTrigger}
                  onSceneVisible={onSceneVisible}
                  fontSize={fontSize}
                  onCharClick={setActiveTab}
                  projectId={projectId}
                  department={department}
                  onSynopsisTag={(sceneId, text) => {
                    const existing = synopsisStore.getSynopsis(sceneId, '');
                    synopsisStore.setSynopsis(sceneId, existing ? `${existing} ${text}` : text);
                    triggerSave();
                  }}
                  onTagCreated={(sceneId, characterId, categoryId, text) => {
                    const charOverrides = useCharacterOverridesStore.getState();
                    const cat = BREAKDOWN_CATEGORIES.find(c => c.id === categoryId);
                    if (!cat) return;

                    if (cat.group === 'breakdown' || cat.group === 'costume_breakdown') {
                      /* Ensure a breakdown entry exists for this scene so the
                         field update is always persisted (and synced to mobile). */
                      let bd = store.getBreakdown(sceneId);
                      if (!bd) {
                        const tagScene = ALL_SCENES.find((s) => s.id === sceneId);
                        bd = {
                          sceneId,
                          timeline: {
                            day: tagScene?.storyDay || '',
                            time: tagScene ? (tagScene.dayNight === 'DAY' ? 'Day' : tagScene.dayNight === 'NIGHT' ? 'Night' : tagScene.dayNight === 'DAWN' ? 'Dawn' : tagScene.dayNight === 'DUSK' ? 'Dusk' : '') : '',
                            type: '', note: '',
                          },
                          characters: (tagScene?.characterIds || []).map((cid) => ({
                            characterId: cid, lookId: '',
                            entersWith: { hair: '', makeup: '', wardrobe: '' },
                            sfx: '', environmental: '', action: '',
                            changeType: 'no-change' as const, changeNotes: '',
                            exitsWith: { hair: '', makeup: '', wardrobe: '' },
                            notes: '',
                          })),
                          continuityEvents: [],
                        };
                        store.setBreakdown(sceneId, bd);
                      }

                      /* Ensure the character has an entry in this breakdown */
                      let cb = bd.characters.find((c) => c.characterId === characterId);
                      if (!cb) {
                        cb = {
                          characterId, lookId: '',
                          entersWith: { hair: '', makeup: '', wardrobe: '' },
                          sfx: '', environmental: '', action: '',
                          changeType: 'no-change', changeNotes: '',
                          exitsWith: { hair: '', makeup: '', wardrobe: '' },
                          notes: '',
                        };
                        store.setBreakdown(sceneId, {
                          ...bd,
                          characters: [...bd.characters, cb],
                        });
                      }

                      /* Tags for breakdown-group categories are pure metadata —
                         they render as pills under the matching form field in
                         CharBlock, and as pills alongside the column value in
                         BreakdownSheet. They no longer auto-fill cb.entersWith
                         / cb.sfx / cb.environmental / cb.action / cb.notes, so
                         manual typing and look-selection can't "erase" them.
                         Suppress unused-variable warning since `cb` is no
                         longer read after the breakdown-ensure guard above. */
                      void cb;
                    } else if (cat.group === 'profile') {
                      /* Auto-fill character profile fields */
                      if (cat.field === 'scriptNotes') {
                        // Script Description tags are stored as tags and displayed in Script Notes tab
                        // No direct field update — the tag itself serves as the record
                      } else {
                        const profileField = cat.field as keyof Character;
                        const char = ALL_CHARACTERS.find((c) => c.id === characterId);
                        if (char) {
                          const resolved = charOverrides.getCharacter(char);
                          const existing = (resolved[profileField] as string) || '';
                          // For notes, append; for other fields, only fill if empty
                          if (profileField === 'notes') {
                            charOverrides.updateCharacter(characterId, {
                              [profileField]: existing ? `${existing}. ${text}` : text,
                            });
                          } else if (!existing) {
                            charOverrides.updateCharacter(characterId, { [profileField]: text });
                          }
                        }
                      }
                    }
                    triggerSave();
                  }}
                />
                <div className="bd-zoom-float">
                  <button className="bd-zoom-btn" onClick={() => setFontSize((s) => Math.max(10, s - 1))}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                  </button>
                  <span className="bd-zoom-label">{fontSize}</span>
                  <button className="bd-zoom-btn" onClick={() => setFontSize((s) => Math.min(22, s + 1))}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </div>
            ) : activeTab === 'supporting-artists' ? (
              <SupportingArtistsPanel artists={sceneSupportingArtists} scene={scene!} allScenes={ALL_SCENES} />
            ) : ALL_CHARACTERS.find((c) => c.id === activeTab) ? (
              <CharacterView
                char={ALL_CHARACTERS.find((c) => c.id === activeTab)!}
                allScenes={ALL_SCENES}
                allLooks={ALL_LOOKS}
              />
            ) : (
              <div className="cv-empty" style={{ padding: 24 }}>Character not found. Select a character tab above.</div>
            )}
          </div>
        </div>

        {/* Right divider */}
        <div className="bd-divider" onMouseDown={rightPanel.onMouseDown} onDoubleClick={rightPanel.onDoubleClick}>
          <div className="bd-divider-grip" />
        </div>

        {/* ━━━ RIGHT — Breakdown Form or Full Breakdown Table ━━━ */}
        <div className={`bd-right bd-panel-surface ${splitView ? 'bd-right--breakdown' : ''}`} style={splitView ? undefined : { width: rightPanel.width, minWidth: rightPanel.width }}>
          <div className="fp-panel-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span className="fp-panel-title">{splitView ? 'Breakdown' : 'Scene Breakdown'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {splitView && (
                  <button
                    className="btn-ghost bd-btn bd-split-close"
                    onClick={() => setSplitView(false)}
                    aria-label="Close breakdown view"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                    </svg>
                  </button>
                )}
            <ToolsMenu
              open={toolsOpen}
              onToggle={() => setToolsOpen(!toolsOpen)}
              onClose={() => setToolsOpen(false)}
              onImportScript={() => setShowUploadModal(true)}
              onOpenBreakdownView={() => setSplitView(true)}
              onExportBreakdown={async (format) => {
                const { exportBreakdownPDF, exportBreakdownXLSX } =
                  await import('@/utils/export/breakdown');
                const preview =
                  format === 'pdf' ? exportBreakdownPDF(projectId)
                  : format === 'xlsx' ? exportBreakdownXLSX(projectId)
                  : null;
                if (preview) setExportPreview(preview);
              }}
              onExportLookbooks={async (format) => {
                const { exportLookbookPDF, exportLookbookPPTX } =
                  await import('@/utils/export/lookbook');
                const preview =
                  format === 'pdf' ? exportLookbookPDF(projectId)
                  : format === 'pptx' ? await exportLookbookPPTX(projectId)
                  : null;
                if (preview) setExportPreview(preview);
              }}
              onExportTimeline={async (format) => {
                const { exportTimelinePDF, exportTimelineXLSX } =
                  await import('@/utils/export/timeline');
                const preview =
                  format === 'pdf' ? exportTimelinePDF(projectId)
                  : format === 'xlsx' ? exportTimelineXLSX(projectId)
                  : null;
                if (preview) setExportPreview(preview);
              }}
              onExportBible={async (format) => {
                if (format !== 'pdf') {
                  console.log('Export bible', format);
                  return;
                }
                const { exportBiblePDF } = await import('@/utils/export/bible');
                setExportPreview(exportBiblePDF(projectId));
              }}
              onExportQueries={async (format) => {
                const { exportQueriesPDF, exportQueriesXLSX } =
                  await import('@/utils/export/queries');
                const preview =
                  format === 'pdf' ? exportQueriesPDF(projectId)
                  : format === 'xlsx' ? exportQueriesXLSX(projectId)
                  : null;
                if (preview) setExportPreview(preview);
              }}
              drafts={drafts}
              draftsLoading={draftsLoading}
              draftsExpanded={draftsExpanded}
              onToggleDraftsExpanded={() => setDraftsExpanded(!draftsExpanded)}
              loadingDraftId={loadingDraftId}
              onLoadDraft={handleLoadDraft}
              onViewDraftPdf={handleViewDraftPdf}
              onDeleteDraft={handleDeleteDraft}
            />
              </div>
            </div>
            {scene && !splitView && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}
              </div>
            )}
          </div>
          {splitView ? (
            <EmbeddedBreakdownTable projectId={projectId} activeSceneId={validSceneId} />
          ) : (
            scene && (
            <BreakdownFormPanel
              projectId={projectId}
              scene={scene} characters={sceneCharacters} breakdown={breakdown}
              activeCharacterId={activeTab !== 'script' ? activeTab : null}
              saveStatus={saveStatus}
              scenes={filteredScenes}
              allScenes={ALL_SCENES}
              allCharacters={ALL_CHARACTERS}
              allLooks={ALL_LOOKS}
              onNavigate={selectScene}
              onUpdate={(cid, data) => { store.updateCharacterBreakdown(validSceneId, cid, data); triggerSave(); }}
              onUpdateTimeline={(tl) => {
                store.updateTimeline(validSceneId, tl);
                // If the user just confirmed a numeric story day on
                // this scene, shift every later scene's *suggested*
                // story day by the same delta so the placeholders
                // moving forward stay consistent with the anchor.
                // Skipped automatically when the anchor or new value
                // isn't a clean integer day, or when either is on a
                // Flashback / Dream / Memory timeline.
                if (scene && tl.dayConfirmed && tl.day && tl.day !== scene.storyDay) {
                  (async () => {
                    const { cascadeStoryDays } = await import('@/utils/cascadeStoryDays');
                    const result = cascadeStoryDays({
                      scenes: ALL_SCENES as never,
                      anchorSceneNumber: scene.number,
                      newDayValue: tl.day,
                      anchorOriginalLabel: scene.storyDay,
                    });
                    if (result.changed.length > 0 && parsedData) {
                      // Update placeholder source so unbroken-down
                      // scenes show the new suggestion.
                      parsedScriptStore.setParsedData(projectId, {
                        ...parsedData,
                        scenes: result.scenes as never,
                      });
                      // Critically: also push the new value into each
                      // affected scene's breakdown.timeline.day
                      // whenever the user hasn't manually confirmed
                      // it. The breakdown is created with timeline.day
                      // pre-filled from scene.storyDay, so without
                      // this step the input keeps showing the stale
                      // initial value even though the placeholder
                      // beneath it has updated.
                      for (const updated of result.changed) {
                        const bd = store.getBreakdown(updated.id);
                        if (!bd) continue;
                        if (bd.timeline.dayConfirmed) continue;
                        store.updateTimeline(updated.id, {
                          ...bd.timeline,
                          day: updated.storyDay,
                        });
                      }
                    }
                  })();
                }
                triggerSave();
              }}
              onAddEvent={(evt) => { store.addContinuityEvent(validSceneId, evt); triggerSave(); }}
              onUpdateEvent={(eventId, data) => { store.updateContinuityEvent(validSceneId, eventId, data); triggerSave(); }}
              onRemoveEvent={(id) => { store.removeContinuityEvent(validSceneId, id); triggerSave(); }}
              onRemoveCharacter={(charId, action, mergeTargetId) => {
                if (action === 'not-in-scene') {
                  parsedScriptStore.removeCharacterFromScene(projectId, validSceneId, charId);
                  store.removeCharacterBreakdown(validSceneId, charId);
                } else if (action === 'not-a-character') {
                  parsedScriptStore.removeCharacterEntirely(projectId, charId);
                  store.removeCharacterFromAllBreakdowns(charId);
                } else if (action === 'duplicate' && mergeTargetId) {
                  parsedScriptStore.mergeCharacters(projectId, charId, mergeTargetId);
                  store.mergeCharacterBreakdowns(charId, mergeTargetId);
                }
                triggerSave();
              }}
              onAddLook={(characterId, name) => {
                const newId = crypto.randomUUID();
                parsedScriptStore.addLook(projectId, {
                  id: newId, characterId, name, description: '', hair: '', makeup: '', wardrobe: '',
                });
                return newId;
              }}
              onUpdateLookField={(lookId, field, value) => {
                // Auto-save: every entersWith edit on a scene with a
                // look selected mirrors back onto the look itself, so
                // the next scene that picks the same look auto-fills
                // from the latest text. Replaces the old "Set Look"
                // button — no explicit save action required.
                parsedScriptStore.updateLook(projectId, lookId, { [field]: value });
                triggerSave();
              }}
              department={department}
            />
            )
          )}
        </div>
      </div>

      {/* Script Upload Modal */}
      {showUploadModal && (
        <ScriptUploadModal
          projectId={projectId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={(filename, diffResult) => {
            updateProject(projectId, { scriptFilename: filename });
            setShowUploadModal(false);
            if (diffResult && diffResult.changes.length > 0) {
              // Store revision changes for highlighting
              revisedStore.setRevision(projectId, {
                changes: diffResult.changes,
                filename,
              });
              // Show changes summary modal
              setShowChangesModal(diffResult);
            }
          }}
        />
      )}

      {/* Draft PDF Viewer */}
      <DraftPdfViewer draft={viewingDraftPdf} onClose={() => setViewingDraftPdf(null)} />

      {/* Changes Summary Modal */}
      {showChangesModal && (
        <ChangesSummaryModal
          diffResult={showChangesModal}
          onClose={() => setShowChangesModal(null)}
          onGoToScene={(sceneId) => {
            // Select the scene + scroll + switch the right panel back to
            // the script tab. Leave the modal open so the user can keep
            // clicking through the change list one item at a time; the
            // modal still closes via the X / Esc / backdrop / footer.
            selectScene(sceneId);
          }}
        />
      )}

      {/* Export preview — previews PDF in iframe; XLSX/DOCX/PPTX show a summary card. */}
      <ExportPreviewModal preview={exportPreview} onClose={() => setExportPreview(null)} />
    </div>
  );
}

