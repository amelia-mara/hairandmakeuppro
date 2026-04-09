import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, BREAKDOWN_CATEGORIES,
  useBreakdownStore, useTagStore, useSynopsisStore, useScriptUploadStore, useParsedScriptStore,
  useCharacterOverridesStore, useRevisedScenesStore,
  type Scene, type Character, type Look,
  type ScriptTag, type ParsedCharacterData,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import { EmbeddedBreakdownTable } from './BreakdownSheet';
import { type DiffResult } from '@/utils/scriptDiff';
import { buildTaggedSegments } from '@/utils/buildTaggedSegments';
import { ordinal } from '@/utils/ordinal';
import { usePanelResize } from '@/hooks/usePanelResize';
import { useScriptDrafts } from '@/hooks/useScriptDrafts';
import { useScriptUploadProcessor } from '@/hooks/useScriptUploadProcessor';
import { SupportingArtistsPanel } from './script-breakdown/SupportingArtistsPanel';
import { ChangesSummaryModal } from './script-breakdown/modals/ChangesSummaryModal';
import { DraftPdfViewer } from './script-breakdown/DraftPdfViewer';
import { ToolsMenu } from './script-breakdown/ToolsMenu';
import { SceneListPanel } from './script-breakdown/SceneListPanel';
import { BreakdownFormPanel } from './script-breakdown/breakdown-form/BreakdownFormPanel';

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

  const rightPanel = usePanelResize('prep-right-panel-w', RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX, 'right');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const store = useBreakdownStore();
  const synopsisStore = useSynopsisStore();

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
    viewingDraftPdf,
    setViewingDraftPdf,
  } = useScriptDrafts({
    projectId,
    isToolsMenuOpen: toolsOpen,
    onCloseToolsMenu: () => setToolsOpen(false),
  });

  /* Resolve data source: parsed script → mock data fallback */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const ALL_SCENES: Scene[] = useMemo(() => parsedData ? parsedData.scenes : MOCK_SCENES, [parsedData]);
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
  const sceneCharacters = scene ? scene.characterIds.map((id) => ALL_CHARACTERS.find((c) => c.id === id)).filter((c): c is Character => !!c) : [];
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
                {BREAKDOWN_CATEGORIES.map((cat) => (
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
                  onSynopsisTag={(sceneId, text) => {
                    const existing = synopsisStore.getSynopsis(sceneId, '');
                    synopsisStore.setSynopsis(sceneId, existing ? `${existing} ${text}` : text);
                    triggerSave();
                  }}
                  onTagCreated={(sceneId, characterId, categoryId, text) => {
                    const charOverrides = useCharacterOverridesStore.getState();
                    const cat = BREAKDOWN_CATEGORIES.find(c => c.id === categoryId);
                    if (!cat) return;

                    if (cat.group === 'breakdown') {
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
                subTab="profile"
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
          <div className="fp-panel-header">
            <span className="fp-panel-title">{splitView ? 'Breakdown' : 'Scene Breakdown'}</span>
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
              onExportBreakdown={() => console.log('Export breakdown')}
              onExportLookbooks={() => console.log('Export lookbooks')}
              onExportTimeline={() => console.log('Export timeline')}
              onExportBible={() => console.log('Export bible')}
              drafts={drafts}
              draftsLoading={draftsLoading}
              draftsExpanded={draftsExpanded}
              onToggleDraftsExpanded={() => setDraftsExpanded(!draftsExpanded)}
              loadingDraftId={loadingDraftId}
              onLoadDraft={handleLoadDraft}
              onViewDraftPdf={handleViewDraftPdf}
            />
          </div>
          {splitView ? (
            <EmbeddedBreakdownTable projectId={projectId} activeSceneId={validSceneId} />
          ) : (
            scene && (
            <BreakdownFormPanel
              scene={scene} characters={sceneCharacters} breakdown={breakdown}
              activeCharacterId={activeTab !== 'script' ? activeTab : null}
              saveStatus={saveStatus}
              scenes={filteredScenes}
              allScenes={ALL_SCENES}
              allCharacters={ALL_CHARACTERS}
              allLooks={ALL_LOOKS}
              onNavigate={selectScene}
              onUpdate={(cid, data) => { store.updateCharacterBreakdown(validSceneId, cid, data); triggerSave(); }}
              onUpdateTimeline={(tl) => { store.updateTimeline(validSceneId, tl); triggerSave(); }}
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
              onSetLook={(lookId, hair, makeup, wardrobe) => {
                // Update the look template with current entersWith values
                parsedScriptStore.updateLook(projectId, lookId, { hair, makeup, wardrobe });
                // Propagate to all scenes that use this look
                const allBreakdowns = store.breakdowns;
                for (const [sceneId, bd] of Object.entries(allBreakdowns)) {
                  for (const ch of bd.characters) {
                    if (ch.lookId === lookId) {
                      store.updateCharacterBreakdown(sceneId, ch.characterId, {
                        entersWith: { hair, makeup, wardrobe },
                      });
                    }
                  }
                }
                triggerSave();
              }}
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
            setShowChangesModal(null);
            setSelectedSceneId(sceneId);
            setScrollTrigger((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* ━━━ SCRIPT VIEW — continuous scroll, all scenes, with tagging ━━━ */

interface TagPopupState {
  x: number; y: number;
  sceneId: string;
  startOffset: number; endOffset: number;
  text: string;
  /** Step 1: pick character, Step 2: pick field/category, edit: edit existing tag */
  step: 'character' | 'field' | 'edit';
  categoryId?: string;
  characterId?: string;
  /** When true, popup appears below the selection instead of above */
  popBelow?: boolean;
  /** Tag IDs being edited (set when step === 'edit') */
  editingTagIds?: string[];
}

function ScriptView({ scenes, preambleScene, characters, selectedSceneId, scrollTrigger, onSceneVisible, fontSize, onCharClick, onTagCreated, onSynopsisTag, projectId }: {
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
  /* Build a set of all name variants that could appear as dialogue cues:
     full names ("LENNON BOWIE") plus individual parts ("LENNON", "BOWIE")
     and titled variants ("MRS. BENNET", "MR. DARCY") */
  const cueNameToChar = useMemo(() => {
    const map = new Map<string, Character>();
    for (const c of characters) {
      map.set(c.name, c);
      // Add individual name parts as cue variants
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

  /* Clamp popup within viewport after render (measures real height) */
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
      // Popup is above viewport — flip to below or push down
      newY = pad;
      newPopBelow = true;
      needsUpdate = true;
    } else if (rect.bottom > window.innerHeight - pad) {
      // Popup is below viewport — push up
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
      // Directly update the element style to avoid re-render loop
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

    /* Find the content container (skip heading) */
    const contentEl = paper.querySelector('.sv-content');
    if (!contentEl) return;

    /* Compute character offsets relative to the scene's scriptContent */
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const scriptText = scene.scriptContent;

    /* Walk the DOM to compute the actual character offset of the selection
       within scriptContent, rather than using indexOf which always finds
       the first occurrence and breaks for repeated words/phrases. */
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

    /* Map DOM text offset to scriptContent offset by finding the closest
       matching position. The DOM text might differ slightly from scriptContent
       (e.g. due to character name highlighting), so we find the selected text
       near the DOM offset position. */
    const domOffset = computeOffset(contentEl, range.startContainer, range.startOffset);
    let startIdx: number;
    if (domOffset >= 0) {
      // Search for the selected text near the DOM offset position
      // to handle cases where DOM text doesn't perfectly align with scriptContent
      const searchStart = Math.max(0, domOffset - 20);
      const nearbyIdx = scriptText.indexOf(text, searchStart);
      startIdx = nearbyIdx !== -1 ? nearbyIdx : scriptText.indexOf(text);
    } else {
      startIdx = scriptText.indexOf(text);
    }
    if (startIdx === -1) return;

    const rect = range.getBoundingClientRect();

    // Estimate popup height (character list ~280px, field picker ~350px)
    const estPopupHeight = 350;
    // Detect if selection is near the top — pop below instead of above
    const popBelow = rect.top < estPopupHeight + 20;
    // Clamp Y so popup never goes above viewport or below it
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

  /* Step 1: User picks a character → advance to field selection */
  const handleCharacterPick = useCallback((charId: string) => {
    if (!popup) return;
    setPopup({ ...popup, step: 'field', characterId: charId });
  }, [popup]);

  /* Step 1b: User creates a new character → add to project and scene, advance to field selection */
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
    // Also add to the breakdown store so they appear in scene breakdown panel
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

  /* Add character to scene — adds to scene.characterIds and creates CharacterBreakdown entry */
  const handleAddCharacterToScene = useCallback(() => {
    if (!popup || !popup.characterId) return;
    const pd = parsedScriptStore.getParsedData(projectId);
    if (!pd) return;
    const scene = pd.scenes.find(s => s.id === popup.sceneId);
    if (!scene) return;
    // Add to scene's characterIds if not already present
    if (!scene.characterIds.includes(popup.characterId)) {
      const updatedScenes = pd.scenes.map(s =>
        s.id === popup.sceneId ? { ...s, characterIds: [...s.characterIds, popup.characterId!] } : s
      );
      parsedScriptStore.setParsedData(projectId, { ...pd, scenes: updatedScenes });
    }
    // Add CharacterBreakdown entry if not already present
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
    // Also create a 'cast' tag to mark the text
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

  /* Step 2: User picks a field/category → create tag + auto-populate */
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

  /* Synopsis pick: tag selected text as synopsis (scene-level, no character) */
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

  /* Edit mode: change category on an existing tag */
  const handleEditChangeCategory = useCallback((tagId: string, newCatId: string) => {
    tagStore.updateTag(tagId, { categoryId: newCatId });
    setPopup(null);
  }, [tagStore]);

  /* Edit mode: delete an existing tag */
  const handleEditDeleteTag = useCallback((tagId: string) => {
    tagStore.removeTag(tagId);
    // If there are more tags being edited, stay open; otherwise close
    if (popup?.editingTagIds && popup.editingTagIds.length > 1) {
      setPopup({
        ...popup,
        editingTagIds: popup.editingTagIds.filter(id => id !== tagId),
      });
    } else {
      setPopup(null);
    }
  }, [tagStore, popup]);

  /* Handle click on a highlighted tag span to open edit popup */
  const handleTagClick = useCallback((e: React.MouseEvent, sceneId: string, tagIds: string[]) => {
    e.stopPropagation();
    const tags = tagIds.map(id => tagStore.tags.find(t => t.id === id)).filter(Boolean) as ScriptTag[];
    if (tags.length === 0) return;
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
      startOffset: tags[0].startOffset,
      endOffset: tags[0].endOffset,
      text: tags[0].text,
      step: 'edit',
      popBelow,
      editingTagIds: tagIds,
    });
  }, [tagStore]);

  /* Build a regex that matches known character names within action/description
     lines so we can highlight them inline. Only multi-word full names and their
     first-name references are matched. Single-word character names and generic
     words (man, cowboy, etc.) are excluded — they only appear on dialogue cues. */
  const charNamePattern = useMemo(() => {
    // Common words that should never be highlighted as first-name fragments
    const GENERIC_WORDS = new Set([
      'MAN', 'WOMAN', 'BOY', 'GIRL', 'OLD', 'YOUNG', 'CHILD', 'BABY',
      'COWBOY', 'COWGIRL', 'DOCTOR', 'NURSE', 'OFFICER', 'CAPTAIN',
      'SERGEANT', 'DETECTIVE', 'AGENT', 'JUDGE', 'PRIEST', 'PASTOR',
      'DRIVER', 'WAITER', 'WAITRESS', 'BARTENDER', 'BARMAN', 'GUARD',
      'SOLDIER', 'GENERAL', 'KING', 'QUEEN', 'PRINCE', 'PRINCESS',
      'MRS', 'MR', 'MISS', 'TALL', 'SHORT', 'BIG', 'FAT', 'THIN',
      'ELDERLY', 'MIDDLE', 'LITTLE', 'BEAUTIFUL', 'PRETTY', 'HANDSOME',
    ]);
    const allNames: { name: string; char: Character }[] = [];
    for (const c of characters) {
      // Skip single-word character names (COWBOY, MAN, etc.)
      if (!/\s/.test(c.name.trim())) continue;
      // Full name always included (e.g. "LENNON BOWIE", "OLD MAN")
      allNames.push({ name: c.name, char: c });
      // First name for inline references — but skip generic words
      const first = c.name.split(/\s+/)[0];
      if (first.length >= 3 && !GENERIC_WORDS.has(first.toUpperCase())) {
        allNames.push({ name: first, char: c });
      }
    }
    // Sort longest first for greedy matching
    allNames.sort((a, b) => b.name.length - a.name.length);
    if (allNames.length === 0) return null;
    const escaped = allNames.map(n => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    return { re, lookup: allNames };
  }, [characters]);

  /** Render a text string with inline character name highlights.
      Character names get the sv-cue-inline class and are clickable. */
  const highlightCharNames = useCallback((text: string, keyPrefix: string): React.ReactNode => {
    if (!charNamePattern || !text) return text;
    const { re, lookup } = charNamePattern;
    re.lastIndex = 0;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const matchText = m[0];
      const upper = matchText.toUpperCase();
      // Find which character this matches
      const entry = lookup.find(n => n.name.toUpperCase() === upper);
      if (!entry) continue;
      // Push text before the match
      if (m.index > lastIdx) {
        parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{text.slice(lastIdx, m.index)}</span>);
      }
      parts.push(
        <span key={`${keyPrefix}-c${m.index}`} className="sv-cue-inline" onClick={(e) => { e.stopPropagation(); onCharClick(entry.char.id); }}>
          {matchText}
        </span>
      );
      lastIdx = m.index + matchText.length;
    }
    if (lastIdx === 0) return text; // no matches
    if (lastIdx < text.length) {
      parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{text.slice(lastIdx)}</span>);
    }
    return <>{parts}</>;
  }, [charNamePattern, onCharClick]);

  /* Render preamble (title page) — centred text with bold title */
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

  /* Render a scene's content with inline highlights */
  const renderSceneContent = useCallback((scene: Scene) => {
    const sceneTags = tagStore.getTagsForScene(scene.id);
    const lines = scene.scriptContent.split('\n');

    /** Strip parentheticals from a line to get the bare cue name */
    function extractCueName(text: string): string {
      return text.replace(/\s*\(.*?\)\s*/g, '').trim();
    }
    /** Check if a trimmed line is a character cue — must be ALL CAPS and match a known character */
    function matchCue(trimmed: string): Character | null {
      if (trimmed !== trimmed.toUpperCase() || trimmed.length > 50) return null;
      const cueName = extractCueName(trimmed);
      if (!cueName) return null;
      return cueNameToChar.get(cueName) || null;
    }

    /* Pre-compute dialogue line indices: lines following a character cue until blank line */
    const dialogueSet = new Set<number>();
    const cueCharMap = new Map<number, Character>(); // line index → matched character
    let inDialogue = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const charMatch = matchCue(trimmed);
      if (charMatch) {
        cueCharMap.set(i, charMatch);
        inDialogue = true;
      } else if (inDialogue) {
        if (trimmed === '') {
          inDialogue = false;
        } else {
          dialogueSet.add(i);
        }
      }
    }

    if (sceneTags.length === 0) {
      /* Plain rendering (no tags to show) */
      return lines.map((line, i) => {
        const trimmed = line.trim();
        const ch = cueCharMap.get(i);
        if (ch) {
          return <div key={`${scene.id}-${i}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{trimmed}</div>;
        }
        if (dialogueSet.has(i)) {
          return <div key={`${scene.id}-${i}`} className="sv-line sv-dialogue">{trimmed || '\u00A0'}</div>;
        }
        // Action/description lines: highlight character names inline
        return <div key={`${scene.id}-${i}`} className="sv-line">{trimmed ? highlightCharNames(trimmed, `${scene.id}-${i}`) : '\u00A0'}</div>;
      });
    }

    /* Tagged rendering — overlay highlights on the full scriptContent */
    const segments = buildTaggedSegments(scene.scriptContent, sceneTags);
    /* Map each character offset to its line */
    let charIdx = 0;
    const lineOffsets: { start: number; end: number; line: string }[] = [];
    for (const line of lines) {
      lineOffsets.push({ start: charIdx, end: charIdx + line.length, line });
      charIdx += line.length + 1; // +1 for \n
    }

    return lineOffsets.map((lo, lineIdx) => {
      const trimmed = lo.line.trim();
      const matched = charNames.find((name) => {
        const cue = trimmed.replace(/\s*\(.*\)$/, '').replace(/\s*\(CONT'D\)$/, '');
        return cue === name;
      });
      const isCue = !!matched;

      /* Find segments that overlap this line */
      const lineSegs = segments.filter((s) => s.start < lo.end + 1 && s.end > lo.start);
      const hasTag = lineSegs.some((s) => s.tags.length > 0);

      const isDialogueLine = dialogueSet.has(lineIdx);

      if (!hasTag) {
        if (isCue) {
          const ch = characters.find((c) => c.name === matched)!;
          return <div key={`${scene.id}-${lineIdx}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{trimmed}</div>;
        }
        if (isDialogueLine) {
          return <div key={`${scene.id}-${lineIdx}`} className="sv-line sv-dialogue">{trimmed || '\u00A0'}</div>;
        }
        return <div key={`${scene.id}-${lineIdx}`} className="sv-line">{lo.line ? highlightCharNames(lo.line, `${scene.id}-${lineIdx}`) : '\u00A0'}</div>;
      }

      /* Render with highlighted spans */
      const parts: React.ReactNode[] = [];
      for (const seg of lineSegs) {
        const segStart = Math.max(seg.start, lo.start) - lo.start;
        const segEnd = Math.min(seg.end, lo.end) - lo.start;
        const segText = lo.line.slice(segStart, segEnd);
        if (seg.tags.length > 0) {
          // Check if any tag is a cast tag
          const castTag = seg.tags.find(t => t.categoryId === 'cast' && t.characterId);
          if (castTag) {
            const charId = castTag.characterId!;
            parts.push(
              <span key={`${seg.start}-${seg.end}`} className="sv-cue-inline"
                onClick={(e) => { e.stopPropagation(); onCharClick(charId); }}
                title={characters.find(c => c.id === charId)?.name || ''}
              >{segText}</span>
            );
          } else {
            // Build combined style for all overlapping tags:
            // background from first tag, multiple underlines via box-shadow
            const tagColors = seg.tags.map(t => {
              const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === t.categoryId);
              return cat?.color || '#888';
            });
            const titleParts = seg.tags.map(t => {
              const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === t.categoryId);
              const label = cat?.label || 'Tag';
              const charName = t.characterId ? characters.find(c => c.id === t.characterId)?.name : '';
              return charName ? `${label} → ${charName}` : label;
            });
            // Use box-shadow for stacked underlines so multiple tags show distinct colors
            const underlines = tagColors.map((color, i) =>
              `inset 0 ${-2 - i * 3}px 0 0 ${color}`
            ).join(', ');
            const segTagIds = seg.tags.map(t => t.id);
            parts.push(
              <span key={`${seg.start}-${seg.end}`} className="sv-highlight sv-highlight--clickable"
                style={{
                  backgroundColor: `${tagColors[0]}33`,
                  borderBottom: 'none',
                  boxShadow: underlines,
                  paddingBottom: seg.tags.length > 1 ? `${(seg.tags.length - 1) * 3}px` : undefined,
                }}
                title={titleParts.join(' | ')}
                onClick={(e) => handleTagClick(e, scene.id, segTagIds)}
              >{segText}</span>
            );
          }
        } else {
          parts.push(<span key={`${seg.start}-${seg.end}`}>{segText}</span>);
        }
      }

      const lineClass = `sv-line${isCue ? ' sv-cue' : isDialogueLine ? ' sv-dialogue' : ''}`;
      return (
        <div key={`${scene.id}-${lineIdx}`} className={lineClass}
          onClick={isCue && matched ? () => { const ch = characters.find((c) => c.name === matched); if (ch) onCharClick(ch.id); } : undefined}>
          {parts}
        </div>
      );
    });
  }, [tagStore, charNames, onCharClick, highlightCharNames, handleTagClick]);

  /* Scroll to scene when selected from the scene list.
     scrollTrigger changes on every explicit scene selection (even re-clicking
     the same scene), so the effect always fires. */
  useEffect(() => {
    const el = pageRefs.current.get(selectedSceneId);
    if (el && scrollRef.current) {
      isScrollingTo.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Use scrollend event when available; fall back to a generous timeout
      // so the IntersectionObserver doesn't override selectedSceneId mid-scroll.
      const container = scrollRef.current;
      const unlock = () => { isScrollingTo.current = false; };
      let timer: ReturnType<typeof setTimeout>;
      if (container && 'onscrollend' in container) {
        const handler = () => { unlock(); container.removeEventListener('scrollend', handler); clearTimeout(timer); };
        container.addEventListener('scrollend', handler, { once: true });
        timer = setTimeout(handler, 1500); // safety fallback
      } else {
        timer = setTimeout(unlock, 1200);
      }
      return () => { clearTimeout(timer); unlock(); };
    }
  }, [selectedSceneId, scrollTrigger]);

  /* Detect which scene is most visible while scrolling.
     Uses a scroll listener instead of IntersectionObserver so we always
     evaluate ALL scene elements on every scroll frame, not just the ones
     that happen to cross a threshold boundary. */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (isScrollingTo.current) return;
        const containerRect = container.getBoundingClientRect();
        // Target zone: top 40% of the container — the area the user is reading
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
    // Run once on mount to sync initial state
    onScroll();
    return () => { container.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId); };
  }, [scenes, onSceneVisible]);

  const setPageRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(id, el);
    else pageRefs.current.delete(id);
  }, []);

  /* All characters available for tag assignment */
  const popupChars = characters;

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
          {/* Merge preamble content into the first scene */}
          {idx === 0 && preambleScene && (
            <div className="sv-content sv-preamble-content">
              {renderPreambleContent(preambleScene)}
            </div>
          )}
          <div className="sv-heading">{scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}</div>
          <div className="sv-content">
            {renderSceneContent(scene)}
          </div>
        </div>
      ))}


      {/* Tag popup — portalled to body so it isn't clipped by scroll overflow */}
      {popup && createPortal(
        <div ref={popupRef} className="sv-tag-popup sv-tag-popup--fixed" style={{
          left: popup.x,
          top: popup.y,
          transform: popup.popBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        }}>
          {popup.step === 'character' && (
            <>
              <div className="sv-tag-popup-title">Assign to character</div>
              <div className="sv-tag-popup-quoted">"{popup.text.length > 50 ? popup.text.slice(0, 50) + '…' : popup.text}"</div>
              <div className="sv-tag-popup-charlist">
                <button className="sv-tag-popup-char-item sv-tag-popup-char-item--synopsis" onClick={handleSynopsisPick}>
                  <span className="sv-tag-popup-char-avatar" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </span>
                  <span>Synopsis</span>
                </button>
                {popupChars.map((ch) => (
                  <button key={ch.id} className="sv-tag-popup-char-item" onClick={() => handleCharacterPick(ch.id)}>
                    <span className="sv-tag-popup-char-avatar">{ch.name.charAt(0)}</span>
                    <span>{ch.name}</span>
                  </button>
                ))}
                <button className="sv-tag-popup-char-item sv-tag-popup-char-item--new" onClick={handleCreateNewCharacter}>
                  <span className="sv-tag-popup-char-avatar" style={{ background: 'rgba(212, 148, 58, 0.2)', color: '#D4943A' }}>+</span>
                  <span>+ Character</span>
                </button>
              </div>
            </>
          )}
          {popup.step === 'field' && (
            <>
              <div className="sv-tag-popup-title">
                Tag as — <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{popupChars.find(c => c.id === popup.characterId)?.name}</span>
              </div>
              {/* Add to Scene — shown when the character is not yet in this scene */}
              {popup.characterId && (() => {
                const scene = scenes.find(s => s.id === popup.sceneId);
                const isInScene = scene?.characterIds.includes(popup.characterId!);
                if (isInScene) return null;
                return (
                  <div className="sv-tag-popup-field-section">
                    <button className="sv-tag-popup-btn sv-tag-popup-btn--add-scene" onClick={handleAddCharacterToScene}>
                      <span className="sv-tag-popup-swatch" style={{ background: 'var(--accent-cue, #B8860B)' }} />
                      Add to Scene
                    </button>
                  </div>
                );
              })()}
              <div className="sv-tag-popup-field-section">
                <div className="sv-tag-popup-field-label">Scene Breakdown</div>
                <div className="sv-tag-popup-grid">
                  {BREAKDOWN_CATEGORIES.filter(c => c.group === 'breakdown').map((cat) => (
                    <button key={cat.id} className="sv-tag-popup-btn" onClick={() => handleFieldPick(cat.id)}>
                      <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sv-tag-popup-field-section">
                <div className="sv-tag-popup-field-label">Character Profile</div>
                <div className="sv-tag-popup-grid">
                  {BREAKDOWN_CATEGORIES.filter(c => c.group === 'profile').map((cat) => (
                    <button key={cat.id} className="sv-tag-popup-btn" onClick={() => handleFieldPick(cat.id)}>
                      <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="sv-tag-popup-char-btn sv-tag-popup-char-btn--skip" onClick={() => setPopup({ ...popup, step: 'character' })}>
                Back
              </button>
            </>
          )}
          {popup.step === 'edit' && popup.editingTagIds && (
            <>
              <div className="sv-tag-popup-title">Edit Tag</div>
              <div className="sv-tag-popup-quoted">"{popup.text.length > 50 ? popup.text.slice(0, 50) + '…' : popup.text}"</div>
              {popup.editingTagIds.map(tagId => {
                const tag = tagStore.tags.find(t => t.id === tagId);
                if (!tag) return null;
                const currentCat = BREAKDOWN_CATEGORIES.find(c => c.id === tag.categoryId);
                const charName = tag.characterId ? characters.find(c => c.id === tag.characterId)?.name : '';
                return (
                  <div key={tagId} className="sv-tag-popup-edit-item">
                    <div className="sv-tag-popup-edit-header">
                      <span className="sv-tag-popup-swatch" style={{ background: currentCat?.color || '#888' }} />
                      <span className="sv-tag-popup-edit-label">{currentCat?.label || 'Tag'}{charName ? ` → ${charName}` : ''}</span>
                      <button className="sv-tag-popup-delete-btn" onClick={() => handleEditDeleteTag(tagId)} title="Delete tag">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                    <div className="sv-tag-popup-edit-cats">
                      {BREAKDOWN_CATEGORIES.filter(c => c.group === 'breakdown').map(cat => (
                        <button key={cat.id}
                          className={`sv-tag-popup-btn${cat.id === tag.categoryId ? ' sv-tag-popup-btn--active' : ''}`}
                          onClick={() => handleEditChangeCategory(tagId, cat.id)}>
                          <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>,
        document.body
      )}

    </div>
  );
}

/* ━━━ SCRIPT UPLOAD MODAL ━━━ */

interface ScriptUploadModalProps {
  projectId: string;
  onClose: () => void;
  onUploaded: (filename: string, diffResult?: DiffResult) => void;
}

function ScriptUploadModal({ projectId, onClose, onUploaded }: ScriptUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { processFile, processing, progress, statusText } = useScriptUploadProcessor({
    projectId,
    selectedFile,
    onUploaded,
    onError: setError,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, processing]);

  const handleFileSelect = (file: File) => {
    const validExts = ['.pdf', '.fdx', '.fountain', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExts.includes(ext)) {
      setError('Invalid file type. Please upload a PDF, FDX, Fountain, or TXT file.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="modal-backdrop" onClick={!processing ? onClose : undefined}>
      <div className="modal-glass" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 28px 0',
        }}>
          <h2 style={{
            fontSize: '0.8125rem', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0,
          }}>
            <span className="heading-italic">Upload</span>{' '}
            <span className="heading-regular">Script</span>
          </h2>
          {!processing && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div style={{ padding: '20px 28px 28px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 20px' }}>
            Upload your screenplay to automatically detect scenes and characters.
          </p>

          {/* Processing state */}
          {processing ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 16,
              }}>
                <div style={{
                  width: `${progress}%`, height: '100%', borderRadius: 3,
                  background: 'var(--accent-gold, #D4943A)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                {statusText}
              </p>
            </div>
          ) : !selectedFile ? (
            /* Drop zone */
            <button
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                width: '100%', padding: '40px 30px', textAlign: 'center',
                border: `2px dashed ${dragOver ? 'var(--accent-gold, #D4943A)' : 'var(--border-subtle, rgba(255,255,255,0.08))'}`,
                borderRadius: 12,
                background: dragOver ? 'rgba(201, 169, 97, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M12 18v-6"/>
                  <path d="M9 15l3-3 3 3"/>
                </svg>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
                Click to upload or drag and drop
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                PDF, FDX (Final Draft), Fountain, or TXT
              </div>
            </button>
          ) : (
            /* File selected */
            <div style={{
              padding: 16, borderRadius: 10,
              background: 'rgba(201, 169, 97, 0.08)',
              border: '1px solid var(--accent-gold, #D4943A)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold, #D4943A)" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: 'var(--text-heading)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {formatSize(selectedFile.size)}
                  </div>
                </div>
                <button onClick={() => { setSelectedFile(null); setError(''); }} style={{
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem',
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}>
                  Remove
                </button>
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: 12 }}>{error}</p>
          )}

          {/* Actions */}
          {!processing && (
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24,
              borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              paddingTop: 20,
            }}>
              <button onClick={onClose} style={{
                padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500,
              }}>
                Cancel
              </button>
              <button
                onClick={processFile}
                disabled={!selectedFile}
                style={{
                  padding: '8px 24px', borderRadius: 8, cursor: selectedFile ? 'pointer' : 'not-allowed',
                  background: selectedFile ? 'var(--accent-gold, #D4943A)' : 'var(--bg-tertiary)',
                  border: 'none',
                  color: selectedFile ? '#1a1a1a' : 'var(--text-muted)',
                  fontSize: '0.8125rem', fontWeight: 600,
                  opacity: selectedFile ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                }}
              >
                Upload & Analyze
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.fdx,.fountain,.txt"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}


/* ━━━ CHARACTER VIEW ━━━ */

function CharacterView({ char, allScenes, allLooks }: { char: Character; subTab: string; allScenes: Scene[]; allLooks: Look[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'lookbook' | 'timeline' | 'events' | 'notes'>('profile');
  const looks = allLooks.filter((l) => l.characterId === char.id);
  const scenes = allScenes.filter((s) => s.characterIds.includes(char.id));
  const bdStore = useBreakdownStore();
  const tagStore = useTagStore();
  const charOverrides = useCharacterOverridesStore();
  const resolvedChar = charOverrides.getCharacter(char);
  const allCharTags = tagStore.getTagsForCharacter(char.id);
  /* Only show tags with descriptions or non-name tags in Script Notes.
     Cast tags that are just the character's name serve only to trigger the tab. */
  const charTags = allCharTags.filter((t) => {
    if (t.categoryId === 'cast' && !t.description) {
      const isOwnName = t.text.trim().toUpperCase() === char.name.toUpperCase();
      if (isOwnName) return false;
    }
    return true;
  });

  const updateField = useCallback((field: string, value: string) => {
    charOverrides.updateCharacter(char.id, { [field]: value });
  }, [char.id, charOverrides]);

  const profileFields: { label: string; key: keyof Character; wide?: boolean }[] = [
    { label: 'Age', key: 'age' },
    { label: 'Gender', key: 'gender' },
    { label: 'Hair Colour', key: 'hairColour' },
    { label: 'Hair Type', key: 'hairType' },
    { label: 'Eye Colour', key: 'eyeColour' },
    { label: 'Skin Tone', key: 'skinTone' },
    { label: 'Build', key: 'build' },
    { label: 'Features', key: 'distinguishingFeatures' },
  ];

  return (
    <div className="cv-wrap">
      <div className="cv-header">
        <div className="cv-avatar">{resolvedChar.name.split(' ').map((n) => n[0]).join('')}</div>
        <div>
          <div className="cv-name">{resolvedChar.name}</div>
          <div className="cv-meta">{ordinal(resolvedChar.billing)} Billing · {resolvedChar.gender} · Age {resolvedChar.age}</div>
        </div>
      </div>
      <div className="cv-subtabs">
        {(['profile', 'lookbook', 'timeline', 'events', 'notes'] as const).map((t) => (
          <button key={t} className={`cv-subtab ${activeSubTab === t ? 'cv-subtab--active' : ''}`}
            onClick={() => setActiveSubTab(t)}>
            {t === 'notes' ? 'Script Notes' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'notes' && charTags.length > 0 && <span className="cv-subtab-badge">{charTags.length}</span>}
          </button>
        ))}
      </div>
      <div className="cv-content">
        {activeSubTab === 'profile' && (
          <div className="cv-grid">
            {profileFields.map(({ label, key }) => (
              <div key={label} className="cv-field">
                <label className="cv-field-label">{label}</label>
                <input
                  className="fi-input cv-field-input"
                  value={resolvedChar[key] as string || ''}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder={`Enter ${label.toLowerCase()}…`}
                />
              </div>
            ))}
            <div className="cv-field cv-field--wide">
              <label className="cv-field-label">Notes</label>
              <textarea
                className="fi-input cv-field-textarea"
                value={resolvedChar.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Enter notes…"
                rows={3}
              />
            </div>
          </div>
        )}
        {activeSubTab === 'lookbook' && (
          <div className="cv-looks">
            {looks.length === 0 ? <p className="cv-empty">No looks created.</p> : looks.slice().sort((a, b) => {
              // Sort by earliest scene number where the look is used
              const earliestScene = (lookId: string) => {
                let min = Infinity;
                for (const s of scenes) {
                  const bd = bdStore.getBreakdown(s.id);
                  if (bd?.characters.some(c => c.lookId === lookId)) {
                    min = Math.min(min, s.number);
                  }
                }
                return min;
              };
              return earliestScene(a.id) - earliestScene(b.id);
            }).map((lk) => (
              <div key={lk.id} className="cv-look-card">
                <div className="cv-look-name">{lk.name}<span className="cv-look-desc"> — {lk.description}</span></div>
                <div className="cv-look-row"><span className="cv-look-label">Hair</span>{lk.hair}</div>
                <div className="cv-look-row"><span className="cv-look-label">Makeup</span>{lk.makeup}</div>
                <div className="cv-look-row"><span className="cv-look-label">Wardrobe</span>{lk.wardrobe}</div>
              </div>
            ))}
          </div>
        )}
        {activeSubTab === 'timeline' && (
          <div className="cv-timeline">
            {scenes.map((s) => {
              const bd = bdStore.getBreakdown(s.id);
              const storyDay = bd?.timeline?.day || s.storyDay || '';
              return (
                <div key={s.id} className="cv-tl-item">
                  <span className="cv-tl-num">Sc {s.number}</span>
                  {storyDay && <span className="cv-tl-day">{storyDay}</span>}
                  <span className="cv-tl-loc">{s.intExt}. {s.location} — {s.dayNight}</span>
                </div>
              );
            })}
          </div>
        )}
        {activeSubTab === 'events' && <p className="cv-empty">No continuity events for this character.</p>}
        {activeSubTab === 'notes' && (
          <div className="cv-notes">
            {charTags.length === 0 ? (
              <p className="cv-empty">No script notes yet. Highlight text in the script and assign it to this character.</p>
            ) : (
              charTags.map((tag) => {
                const tagScene = allScenes.find((s) => s.id === tag.sceneId);
                const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === tag.categoryId);
                return (
                  <div key={tag.id} className="cv-note-card">
                    <div className="cv-note-header">
                      <span className="cv-note-cat" style={{ color: cat?.color }}>
                        <span className="bd-legend-swatch" style={{ background: cat?.color }} />
                        {cat?.label}
                      </span>
                      {tagScene && <span className="cv-note-scene">Sc {tagScene.number}</span>}
                      <button className="cv-note-remove" onClick={() => tagStore.removeTag(tag.id)} title="Remove tag">×</button>
                    </div>
                    <div className="cv-note-text">"{tag.text}"</div>
                    {tag.description && <div className="cv-note-desc">{tag.description}</div>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

