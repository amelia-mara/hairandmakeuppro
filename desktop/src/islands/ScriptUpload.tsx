/**
 * ScriptUpload Island
 *
 * A React island that replaces the legacy text-paste import modal with a
 * streamlined PDF upload → scene parsing → character confirmation flow.
 *
 * Mount point: #island-script-upload
 *
 * Flow:
 * 1. idle      → Drag-drop PDF upload zone
 * 2. reading   → Reading PDF file
 * 3. extracting → Extracting text from PDF pages
 * 4. parsing   → Finding scenes via regex
 * 5. detecting → Detecting characters via regex pre-extraction
 * 6. confirming → User confirms character selection
 * 7. complete  → Data pushed to legacy state, UI rendered
 * 8. error     → Error state with retry
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { notifyStateChange } from './bridge';

// ── PDF.js Worker ───────────────────────────────────────────────────────────

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── Types ───────────────────────────────────────────────────────────────────

interface ParsedScene {
  number: number;
  heading: string;
  lineNumber: number;
  synopsis: string | null;
  storyDay: string;
  timeOfDay: string;
  intExt: string;
  location: string;
  content: string;
  characters: Record<string, any>;
}

interface DetectedCharacter {
  name: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: number[];
  roleType: 'lead' | 'supporting' | 'day_player' | 'extra';
  selected: boolean;
}

type ProcessingStep =
  | 'idle'
  | 'reading'
  | 'extracting'
  | 'parsing'
  | 'detecting'
  | 'confirming'
  | 'complete'
  | 'error';

interface StepInfo {
  label: string;
  detail?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ScriptUpload() {
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  // Processing results
  const [scenes, setScenes] = useState<ParsedScene[]>([]);
  const [characters, setCharacters] = useState<DetectedCharacter[]>([]);
  const [rawText, setRawText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // ── Visibility: the island shows when triggered ─────────────────────────

  const [visible, setVisible] = useState(false);

  // Listen for the legacy "Import Script" button to open us instead of the old modal
  useEffect(() => {
    const handleOpen = () => {
      setVisible(true);
      setStep('idle');
      setSteps([]);
      setProgress(0);
      setErrorMessage('');
      setScenes([]);
      setCharacters([]);
      setRawText('');
      setFileName('');
    };

    // Intercept the legacy openImportModal
    const originalOpen = (window as any).openImportModal;
    (window as any).openImportModal = () => {
      handleOpen();
    };

    // Also listen for custom event
    window.addEventListener('island:open-script-upload', handleOpen);

    return () => {
      if (originalOpen) {
        (window as any).openImportModal = originalOpen;
      }
      window.removeEventListener('island:open-script-upload', handleOpen);
    };
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  // ── File handling ───────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please upload a PDF file.');
      setStep('error');
      return;
    }

    setFileName(file.name);

    try {
      // Step 1: Reading
      setStep('reading');
      setSteps([{ label: 'Reading PDF' }]);
      setProgress(10);

      const arrayBuffer = await file.arrayBuffer();

      // Step 2: Extracting
      setStep('extracting');
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      setSteps((prev) => [
        { ...prev[0], detail: 'done' },
        { label: 'Extracting text', detail: `${totalPages} pages` },
      ]);
      setProgress(20);

      let fullText = '';
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Group text items by Y position for line reconstruction
        const lines: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

        for (const item of textContent.items as any[]) {
          if (!item.str || item.str.trim() === '') continue;
          const y = Math.round(item.transform[5] / 2) * 2;
          const x = item.transform[4];
          if (!lines.has(y)) lines.set(y, []);
          lines.get(y)!.push({ x, text: item.str, width: item.width || 0 });
        }

        // Sort lines top-to-bottom (descending Y)
        const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);

        for (const y of sortedY) {
          const lineItems = lines.get(y)!;
          lineItems.sort((a, b) => a.x - b.x);

          let lineText = '';
          let lastX = 0;
          let lastWidth = 0;

          for (const item of lineItems) {
            const gap = item.x - (lastX + lastWidth);
            if (lastX > 0 && gap > 3) {
              lineText += gap > 20 ? '    ' : ' ';
            }
            lineText += item.text;
            lastX = item.x;
            lastWidth = item.width;
          }

          fullText += lineText.trimEnd() + '\n';
        }
        fullText += '\n';

        // Update progress per page
        setProgress(20 + Math.round((pageNum / totalPages) * 30));
      }

      // Normalize text
      fullText = normalizeScriptText(fullText);
      setRawText(fullText);

      setSteps((prev) => [
        prev[0],
        { ...prev[1], detail: `${totalPages} pages done` },
      ]);

      // Step 3: Parsing scenes
      setStep('parsing');
      setProgress(55);
      setSteps((prev) => [
        ...prev,
        { label: 'Finding scenes' },
      ]);

      const parsedScenes = detectScenes(fullText);
      setScenes(parsedScenes);

      setSteps((prev) => {
        const updated = [...prev];
        updated[2] = { label: 'Finding scenes', detail: `${parsedScenes.length} found` };
        return updated;
      });

      // Step 4: Detecting characters
      setStep('detecting');
      setProgress(70);
      setSteps((prev) => [
        ...prev,
        { label: 'Detecting characters' },
      ]);

      const detectedChars = detectCharacters(fullText, parsedScenes);
      setCharacters(detectedChars);
      setProgress(90);

      setSteps((prev) => {
        const updated = [...prev];
        updated[3] = { label: 'Detecting characters', detail: `${detectedChars.length} found` };
        return updated;
      });

      // Step 5: Confirming
      setStep('confirming');
      setProgress(100);

    } catch (err: any) {
      console.error('[ScriptUpload] Error:', err);
      setErrorMessage(err.message || 'Failed to process PDF');
      setStep('error');
    }
  }, []);

  // ── Drag & Drop ─────────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const onBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Character confirmation ──────────────────────────────────────────────

  const toggleCharacter = useCallback((index: number) => {
    setCharacters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      return updated;
    });
  }, []);

  const selectAll = useCallback(() => {
    setCharacters((prev) => prev.map((c) => ({ ...c, selected: true })));
  }, []);

  const deselectExtras = useCallback(() => {
    setCharacters((prev) =>
      prev.map((c) => ({
        ...c,
        selected: c.roleType === 'extra' ? false : c.selected,
      }))
    );
  }, []);

  // ── Confirm & integrate with legacy ─────────────────────────────────────

  const confirmAndContinue = useCallback(() => {
    const win = window as any;
    const state = win.state;
    if (!state) {
      console.error('[ScriptUpload] window.state not found');
      return;
    }

    const selectedChars = characters.filter((c) => c.selected);

    // 1. Store script text
    if (!state.currentProject) {
      state.currentProject = {
        id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: 'Untitled Project',
        created: Date.now(),
      };
    }
    state.currentProject.scriptContent = rawText;

    // 2. Store scenes
    state.scenes = scenes;
    state.currentProject.scenes = scenes;

    // 3. Store confirmed characters
    state.confirmedCharacters = new Set(selectedChars.map((c) => c.name));
    state.characters = state.confirmedCharacters;
    state.detectedCharacters = characters.map((c) => ({
      name: c.name,
      category: c.roleType === 'lead' ? 'LEAD' : c.roleType === 'supporting' ? 'SUPPORTING' : 'DAY_PLAYER',
      sceneCount: c.sceneCount,
      dialogueCount: c.dialogueCount,
      scenesPresent: c.scenes,
      hasDialogue: c.dialogueCount > 0,
      selected: c.selected,
    }));

    // 4. Initialize empty breakdowns for each scene
    if (!state.sceneBreakdowns) state.sceneBreakdowns = {};

    // 5. Initialize cast profiles
    if (!state.castProfiles) state.castProfiles = {};
    for (const char of selectedChars) {
      if (!state.castProfiles[char.name]) {
        state.castProfiles[char.name] = {
          baseDescription: '',
          scenes: char.scenes,
          lookStates: [],
        };
      }
    }

    // 6. Initialize character tabs
    state.characterTabs = selectedChars.map((c) => c.name);

    // 7. Trigger legacy UI renders
    const renderFns = [
      'renderSceneList',
      'renderScript',
      'renderCharacterTabs',
      'renderCharacterTabPanels',
    ];
    for (const fn of renderFns) {
      if (typeof win[fn] === 'function') {
        try { win[fn](); } catch (e) { console.warn(`[ScriptUpload] ${fn} failed:`, e); }
      }
    }

    // 8. Select first scene
    if (typeof win.selectScene === 'function' && scenes.length > 0) {
      win.selectScene(0);
    }

    // 9. Close the old import modal just in case
    if (typeof win.closeImportModal === 'function') {
      try { win.closeImportModal(); } catch (_e) { /* ignore */ }
    }

    // 10. Save project
    if (typeof win.saveProject === 'function') {
      win.saveProject();
    } else {
      // Try the module export path
      import('./bridge').then(({ callLegacy }) => callLegacy('saveProject'));
    }

    // 11. Update workflow status
    if (typeof win.updateWorkflowStatus === 'function') {
      win.updateWorkflowStatus();
    }

    // 12. Notify other islands
    notifyStateChange();
    window.dispatchEvent(
      new CustomEvent('script-loaded', { detail: { scenes, characters: selectedChars } })
    );

    setStep('complete');
    setTimeout(() => setVisible(false), 600);
  }, [characters, scenes, rawText]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <div style={S.overlay} onClick={close}>
      <div
        ref={modalRef}
        style={S.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>
            {step === 'confirming' ? 'Confirm Characters' : 'Import Script'}
          </span>
          <button style={S.closeBtn} onClick={close}>&times;</button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {step === 'idle' && (
            <UploadZone
              dragOver={dragOver}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onBrowse={onBrowse}
              fileInputRef={fileInputRef}
              onFileChange={onFileChange}
            />
          )}

          {(step === 'reading' || step === 'extracting' || step === 'parsing' || step === 'detecting') && (
            <ProgressView steps={steps} progress={progress} />
          )}

          {step === 'confirming' && (
            <CharacterConfirmation
              characters={characters}
              onToggle={toggleCharacter}
              onSelectAll={selectAll}
              onDeselectExtras={deselectExtras}
              onConfirm={confirmAndContinue}
              onCancel={close}
            />
          )}

          {step === 'complete' && (
            <div style={S.completeView}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Script Loaded</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
                {scenes.length} scenes &bull; {characters.filter((c) => c.selected).length} characters
              </div>
            </div>
          )}

          {step === 'error' && (
            <div style={S.errorView}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#9888;</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                Something went wrong
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
                {errorMessage}
              </div>
              <button style={S.goldBtn} onClick={() => setStep('idle')}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function UploadZone({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  fileInputRef,
  onFileChange,
}: {
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div
      style={{
        ...S.dropZone,
        borderColor: dragOver ? '#C9A962' : 'rgba(255,255,255,0.15)',
        background: dragOver ? 'rgba(201,169,98,0.08)' : 'rgba(255,255,255,0.02)',
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onBrowse}
    >
      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.7 }}>&#128196;</div>
      <div style={{ fontSize: '16px', color: '#fff', marginBottom: '8px' }}>
        Drop your script here
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px' }}>
        PDF files
      </div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', marginBottom: '20px' }}>
        &mdash;&mdash;&mdash;&mdash;&mdash; or &mdash;&mdash;&mdash;&mdash;&mdash;
      </div>
      <button style={S.browseBtn} onClick={(e) => { e.stopPropagation(); onBrowse(); }}>
        Browse Files
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </div>
  );
}

function ProgressView({ steps, progress }: { steps: StepInfo[]; progress: number }) {
  return (
    <div style={S.progressView}>
      <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>
        Analyzing Script
      </div>

      {/* Step list */}
      <div style={{ marginBottom: '24px' }}>
        {steps.map((s, i) => {
          const isDone = s.detail === 'done' || (s.detail && s.detail.includes('done')) ||
                         (s.detail && s.detail.includes('found'));
          const isCurrent = i === steps.length - 1 && !isDone;
          return (
            <div key={i} style={S.stepRow}>
              <span style={{ marginRight: '10px', width: '16px', textAlign: 'center' }}>
                {isDone ? (
                  <span style={{ color: '#34d399' }}>&#10003;</span>
                ) : isCurrent ? (
                  <span style={{ color: '#C9A962' }}>&#9679;</span>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>&#9675;</span>
                )}
              </span>
              <span style={{ color: isDone ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                {s.label}
              </span>
              {s.detail && s.detail !== 'done' && (
                <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
                  ({s.detail})
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={S.progressTrack}>
        <div
          style={{
            ...S.progressFill,
            width: `${progress}%`,
          }}
        />
      </div>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '8px' }}>
        {progress}%
      </div>
    </div>
  );
}

function CharacterConfirmation({
  characters,
  onToggle,
  onSelectAll,
  onDeselectExtras,
  onConfirm,
  onCancel,
}: {
  characters: DetectedCharacter[];
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onDeselectExtras: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const selectedCount = characters.filter((c) => c.selected).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '12px' }}>
        Found {characters.length} characters. Deselect any you don't need to track.
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button style={S.smallBtn} onClick={onSelectAll}>Select All</button>
        <button style={S.smallBtn} onClick={onDeselectExtras}>Deselect Extras</button>
      </div>

      {/* Character list */}
      <div style={S.charList}>
        {characters.map((char, i) => (
          <div
            key={char.name}
            style={{
              ...S.charRow,
              opacity: char.selected ? 1 : 0.45,
            }}
            onClick={() => onToggle(i)}
          >
            <span style={S.checkbox}>
              {char.selected ? '\u2611' : '\u2610'}
            </span>
            <span style={S.charName}>{char.name}</span>
            <span style={{
              ...S.roleBadge,
              background:
                char.roleType === 'lead' ? 'rgba(201,169,98,0.25)' :
                char.roleType === 'supporting' ? 'rgba(255,255,255,0.1)' :
                'rgba(255,255,255,0.05)',
              color:
                char.roleType === 'lead' ? '#C9A962' :
                char.roleType === 'supporting' ? 'rgba(255,255,255,0.7)' :
                'rgba(255,255,255,0.35)',
            }}>
              {char.roleType === 'lead' ? 'Lead' :
               char.roleType === 'supporting' ? 'Supporting' :
               char.roleType === 'day_player' ? 'Day Player' : 'Extra'}
            </span>
            <span style={S.sceneCount}>
              {char.sceneCount} scene{char.sceneCount !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={S.confirmFooter}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
          {selectedCount} of {characters.length} selected
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={S.cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={S.goldBtn} onClick={onConfirm}>
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Script Processing Functions ─────────────────────────────────────────────

/**
 * Normalize script text to fix common PDF extraction issues.
 * Copied from mobile-pwa/src/utils/scriptParser.ts
 */
function normalizeScriptText(text: string): string {
  return text
    .replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.')
    .replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2')
    .replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUOUS')
    .replace(/CONT[''\u2019]?D/gi, "CONT'D")
    .replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)')
    .replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/(\d+[A-Z]?)\s+\./g, '$1.')
    .trim();
}

/**
 * Detect scenes from script text.
 * Matches the legacy desktop detectScenes() format so window.state.scenes is compatible.
 */
function detectScenes(text: string): ParsedScene[] {
  const lines = text.split('\n');
  const detected: ParsedScene[] = [];

  const patterns = [
    /^(\d+\.?\s*)?(INT\.|EXT\.|INT\/EXT\.|I\/E\.).*$/i,
    /^(INT|EXT)\s+[-\u2013\u2014]\s+.+$/i,
  ];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        const sceneIndex = detected.length;
        detected.push({
          number: sceneIndex + 1,
          heading: trimmed,
          lineNumber: index,
          synopsis: null,
          storyDay: '',
          timeOfDay: detectTimeOfDay(trimmed),
          intExt: detectIntExt(trimmed),
          location: extractLocation(trimmed),
          content: '',
          characters: {},
        });
        break;
      }
    }
  });

  // Extract scene content
  detected.forEach((scene, idx) => {
    const startLine = scene.lineNumber;
    const endLine = idx < detected.length - 1
      ? detected[idx + 1].lineNumber
      : lines.length;
    scene.content = lines.slice(startLine, endLine).join('\n');
  });

  return detected;
}

function detectTimeOfDay(heading: string): string {
  const upper = heading.toUpperCase();
  if (upper.includes('MORNING')) return 'Morning';
  if (upper.includes('AFTERNOON')) return 'Afternoon';
  if (upper.includes('EVENING')) return 'Evening';
  if (upper.includes('NIGHT')) return 'Night';
  if (upper.includes('DUSK')) return 'Dusk';
  if (upper.includes('DAWN')) return 'Dawn';
  if (upper.includes('SUNSET')) return 'Sunset';
  if (upper.includes('SUNRISE')) return 'Sunrise';
  if (upper.includes('CONTINUOUS') || upper.includes("CONT'D")) return 'Continuous';
  if (upper.includes('LATER')) return 'Later';
  if (upper.includes('DAY')) return 'Day';
  return '';
}

function detectIntExt(heading: string): string {
  const upper = heading.toUpperCase();
  if (upper.includes('INT/EXT') || upper.includes('INT./EXT.')) return 'INT/EXT';
  if (upper.includes('I/E')) return 'INT/EXT';
  if (upper.includes('INT')) return 'INT';
  if (upper.includes('EXT')) return 'EXT';
  return '';
}

function extractLocation(heading: string): string {
  return heading
    .replace(/^(\d+\.?\s*)?(INT\.|EXT\.|INT\/EXT\.|I\/E\.?)\s*/i, '')
    .replace(/\s*[-\u2013\u2014]\s*(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN|CONTINUOUS|LATER|SUNSET|SUNRISE).*$/i, '')
    .trim() || heading;
}

// ── Character Detection ─────────────────────────────────────────────────────

/** Comprehensive blacklist from mobile scriptParser.ts */
const NON_CHARACTER_WORDS = new Set([
  'HE','SHE','IT','WE','ME','US','HIM','HER','HIS','ITS',
  'THEY','THEM','THEIR','WHO','WHOM','WHOSE','WHAT','WHICH',
  'THAT','THIS','THESE','THOSE','MYSELF','HIMSELF','HERSELF',
  'ITSELF','OURSELVES','THEMSELVES','YOURSELF',
  'BUT','FOR','NOT','ALL','WITH','FROM','INTO','UPON',
  'THAN','YET','NOR','SINCE','UNTIL','WHILE','DURING',
  'THROUGH','BETWEEN','AGAINST','WITHOUT','WITHIN','BEYOND',
  'ALONG','ACROSS','TOWARD','TOWARDS','AROUND','OVER','UNDER',
  'AFTER','BEFORE','NEAR','FAR',
  'AS','AT','BY','IF','OF','ON','OR','TO','UP','SO',
  'DO','GO','AM','AN','BE','MY','OUR','YOUR','TOO',
  'HOW','WHY','OFF','OUT','BACK','DOWN','AWAY',
  'INT','EXT','ROAD','STREET','HOUSE','ROOM','OFFICE','BUILDING',
  'HALL','HALLWAY','CORRIDOR','LOBBY','FOYER','STAIRS','STAIRCASE',
  'BASEMENT','ATTIC','GARAGE','PORCH','BALCONY','TERRACE','ROOFTOP',
  'GARDEN','YARD','ALLEY','PARK','FIELD','PLAZA','SQUARE',
  'BRIDGE','TUNNEL','CAVE','CLIFF','LEDGE','RIDGE','SUMMIT','PEAK',
  'CHURCH','TEMPLE','HOSPITAL','SCHOOL','PRISON','JAIL','COURTHOUSE',
  'AIRPORT','STATION','HARBOR','HARBOUR','DOCK','PIER','WAREHOUSE',
  'FACTORY','LABORATORY','BUNKER','SHELTER','CABIN','COTTAGE','MANOR',
  'CASTLE','PALACE','TOWER','FORT','FORTRESS','CAMP','TENT',
  'KITCHEN','BATHROOM','BEDROOM','PARLOR','PARLOUR','STUDY','LIBRARY',
  'CAFETERIA','RESTAURANT','BAR','PUB','CLUB','CASINO','THEATER','THEATRE',
  'CEMETERY','GRAVEYARD','MORGUE','AUTOPSY','COURTROOM','PRECINCT',
  'CLASSROOM','GYMNASIUM','STADIUM','ARENA','RINK',
  'DAY','NIGHT','MORNING','EVENING','DAWN','DUSK','LATER','CONTINUOUS',
  'MIDNIGHT','NOON','AFTERNOON','TWILIGHT','SUNSET','SUNRISE',
  'EDENIC','VERDANT','TOWERING','LONELY','BEAUTIFUL','GORGEOUS','STUNNING',
  'SERENE','PEACEFUL','WILD','FIERCE','ANCIENT','MODERN','RUSTIC',
  'EXTREME','ALMOST','ABOUT','READY','SUDDENLY','FINALLY','SLOWLY',
  'QUICKLY','QUIETLY','LOUDLY','SOFTLY','GENTLY','ROUGHLY','BARELY',
  'EXACTLY','SIMPLY','MERELY','UTTERLY','COMPLETELY','ENTIRELY',
  'ACTUALLY','BASICALLY','APPARENTLY','OBVIOUSLY','CLEARLY','CERTAINLY',
  'PERHAPS','MAYBE','PROBABLY','POSSIBLY','LIKELY','UNLIKELY',
  'TOGETHER','ALONE','APART','AHEAD','BEHIND','ABOVE','BELOW',
  'INSIDE','OUTSIDE','UPSTAIRS','DOWNSTAIRS','NEARBY','ELSEWHERE',
  'FOREVER','ALWAYS','NEVER','SOMETIMES','OFTEN','RARELY','SELDOM',
  'ALREADY','ANYWAY','HOWEVER','MEANWHILE','OTHERWISE','THEREFORE',
  'ABSOLUTELY','DEFINITELY','SERIOUSLY','LITERALLY',
  'SILENCE','DARKNESS','NOTHING','EVERYTHING','SOMETHING','ANYTHING',
  'NOBODY','EVERYBODY','SOMEONE','ANYONE','EVERYONE','NOWHERE','EVERYWHERE',
  'TIME','SPACE','PLACE','HOME','WORLD','EARTH','HEAVEN','HELL',
  'LOVE','HATE','FEAR','HOPE','DEATH','LIFE','TRUTH','LIES','POWER',
  'MONEY','BLOOD','FIRE','SMOKE','DUST','SAND','MUD','ICE','FROST',
  'THUNDER','LIGHTNING','STORM','EXPLOSION','CRASH','BANG','BOOM',
  'SCREAM','WHISPER','ECHO','VOICE','SOUND','NOISE','MUSIC',
  'CHAOS','PANIC','MAYHEM','CARNAGE','WRECKAGE','DEBRIS','RUBBLE',
  'SHOCK','HORROR','TERROR','RAGE','FURY','AGONY','GRIEF','ANGER',
  'RELIEF','DESPAIR','SURPRISE','WONDER','DISGUST','SORROW','DREAD',
  'LIKE','JUST','ONLY','REAL','TRUE','SAME','DIFFERENT','SPECIAL',
  'SECRET','PRIVATE','PUBLIC','FINAL','TOTAL','PERFECT','COMPLETE',
  'TYPE','OPEN','SHUT','EMPTY','FULL','BUSY','FREE','SAFE',
  'LUCKY','SORRY','GUILTY','WRONG','CRAZY','ANGRY','UPSET',
  'MOUNTAINS','MOUNTAIN','HILLS','VALLEY','RIVER','STREAM','LAKE','OCEAN',
  'FOREST','WOODS','TREE','TREES','SKY','SUN','MOON','MELTWATER',
  'DESERT','JUNGLE','SWAMP','MARSH','BOG','MEADOW','PRAIRIE','PLAIN',
  'ISLAND','COAST','SHORE','WATERFALL','VOLCANO','GLACIER','CANYON',
  'RED','BLUE','GREEN','YELLOW','ORANGE','PURPLE','BLACK','WHITE','GOLDEN',
  'CRIMSON','SCARLET','AZURE','IVORY','SILVER',
  'VERY','MUCH','MORE','MOST','ALSO','EVEN','STILL','WELL',
  'ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN',
  'FIRST','SECOND','THIRD','LAST','NEXT','ANOTHER','HALF','DOUBLE','TRIPLE',
  'CONTINUED','FADE','CUT','DISSOLVE','ANGLE','SHOT','VIEW','CLOSE','WIDE',
  'RESUME','BEGIN','END','STOP','START','PAUSE','BEAT',
  'PRELAP','OVERLAP','INTERCUT','MONTAGE','SERIES','SEQUENCE',
  'PHONE','GUN','KNIFE','SWORD','WEAPON','BOMB','GRENADE','RIFLE',
  'CAR','TRUCK','BUS','TRAIN','PLANE','HELICOPTER','BOAT','SHIP',
  'TAXI','AMBULANCE','MOTORCYCLE','BICYCLE','WHEELCHAIR','VEHICLE',
  'DOOR','WINDOW','WALL','FLOOR','CEILING','ROOF',
  'TABLE','CHAIR','DESK','BED','COUCH','SOFA','BENCH',
  'LAMP','MIRROR','CLOCK','SCREEN','MONITOR','COMPUTER','LAPTOP',
  'RADIO','TELEVISION','CAMERA','MICROPHONE','SPEAKER',
  'BAG','BOX','CASE','TRUNK','CHEST','DRAWER','CABINET','SHELF',
  'BOTTLE','GLASS','CUP','PLATE','BOWL','TRAY','BASKET',
  'KEY','LOCK','CHAIN','ROPE','WIRE','CABLE','PIPE','TUBE',
  'SIGN','FLAG','BANNER','POSTER','PHOTO','PICTURE','PAINTING',
  'BOOK','LETTER','NOTE','MAP','CARD','ENVELOPE','PACKAGE',
  'RING','NECKLACE','BRACELET','WATCH','HELMET','MASK','BADGE',
  'TITLE','CREDIT','CREDITS','SUBTITLE','CAPTION',
  'CHAPTER','PART','ACT','SCENE','EPISODE','PILOT',
  'DREAM','NIGHTMARE','MEMORY','VISION','FLASHBACK','FANTASY',
  'PRESENT','PAST','FUTURE','HISTORY','LEGEND','MYTH','PROPHECY',
  'UNKNOWN','UNTITLED','UNNAMED','UNIDENTIFIED','ANONYMOUS',
  'VARIOUS','SEVERAL','MULTIPLE','NUMEROUS','COUNTLESS',
  'OTHER','EITHER','NEITHER','BOTH','NONE','EACH','EVERY',
  'HERE','THERE','WHERE','WHEN','THEN','NOW','SOON','AGO','HENCE',
  'AGAIN','ONCE','TWICE','THRICE',
  'OKAY','YEAH','SURE','RIGHT','FALSE','YES','NO',
]);

const NON_CHARACTER_PHRASES = new Set([
  'VOICE OVER','VOICE MAIL','TIME LAPSE','TIME CUT','TIME JUMP',
  'SLOW MOTION','FREEZE FRAME','SPLIT SCREEN',
  'WIDE SHOT','CLOSE UP','MEDIUM SHOT','LONG SHOT','AERIAL SHOT',
  'PUSH IN','PULL BACK','PAN LEFT','PAN RIGHT',
  'SMASH CUT','JUMP CUT','MATCH CUT','HARD CUT',
  'FADE IN','FADE OUT','FADE UP','BLACK OUT','WHITE OUT',
  'TITLE CARD','END CREDITS','OPENING CREDITS',
  'STOCK FOOTAGE','NEXT DAY','SAME DAY','THAT NIGHT',
  'NEXT MORNING','SOME TIME','YEARS LATER','MONTHS LATER',
  'DAYS LATER','HOURS LATER','WEEKS LATER',
  'DREAM SEQUENCE','TITLE SEQUENCE','ACTION SEQUENCE',
  'THE END','TO BE',
]);

/**
 * Detect characters from script text using regex pre-extraction.
 * Follows the mobile pattern: find dialogue cues, filter through blacklist,
 * count occurrences, classify by role.
 */
function detectCharacters(text: string, scenes: ParsedScene[]): DetectedCharacter[] {
  const charMap = new Map<string, { dialogueCount: number; scenes: Set<number> }>();

  // Pattern: standard dialogue cues — name on its own line in ALL CAPS
  const dialogueCuePattern = /^([A-Z][A-Z\s.'\-]{1,30})\s*(?:\([^)]*\))?\s*$/gm;

  let match: RegExpExecArray | null;
  while ((match = dialogueCuePattern.exec(text)) !== null) {
    let name = match[1].trim();

    // Strip V.O., O.S., CONT'D suffixes
    name = name.replace(/\s*\(?(?:V\.?O\.?|O\.?S\.?|CONT['\u2019]?D?)\)?\s*$/gi, '').trim();

    if (!isValidCharacterName(name)) continue;

    // Title-case normalize
    const normalized = toTitleCase(name);

    if (!charMap.has(normalized)) {
      charMap.set(normalized, { dialogueCount: 0, scenes: new Set() });
    }
    charMap.get(normalized)!.dialogueCount++;

    // Find which scene this line belongs to
    const lineIndex = text.substring(0, match.index).split('\n').length - 1;
    for (let i = scenes.length - 1; i >= 0; i--) {
      if (scenes[i].lineNumber <= lineIndex) {
        charMap.get(normalized)!.scenes.add(i);
        break;
      }
    }
  }

  // Convert to array and classify
  const result: DetectedCharacter[] = Array.from(charMap.entries())
    .map(([name, data]) => {
      const sceneCount = data.scenes.size;
      const totalScenes = scenes.length;
      let roleType: DetectedCharacter['roleType'];

      if (sceneCount >= totalScenes * 0.15 || sceneCount >= 8) {
        roleType = 'lead';
      } else if (sceneCount >= 3) {
        roleType = 'supporting';
      } else if (sceneCount >= 2) {
        roleType = 'day_player';
      } else {
        roleType = 'extra';
      }

      return {
        name,
        sceneCount,
        dialogueCount: data.dialogueCount,
        scenes: Array.from(data.scenes).sort((a, b) => a - b),
        roleType,
        // Auto-select: leads, supporting, day_players selected; extras deselected
        selected: roleType !== 'extra',
      };
    })
    // Sort: leads first, then by scene count desc
    .sort((a, b) => {
      const roleOrder = { lead: 0, supporting: 1, day_player: 2, extra: 3 };
      const roleDiff = roleOrder[a.roleType] - roleOrder[b.roleType];
      if (roleDiff !== 0) return roleDiff;
      return b.sceneCount - a.sceneCount;
    });

  return result;
}

function isValidCharacterName(name: string): boolean {
  const upper = name.toUpperCase().trim();

  if (upper.length < 2 || upper.length > 35) return false;
  if (/^\d/.test(upper)) return false;

  // Non-character line patterns
  if (/^(INT\.|EXT\.|INT\/EXT|I\/E\.)/.test(upper)) return false;
  if (/^(CUT TO|FADE|DISSOLVE|SMASH|MATCH|WIPE)/.test(upper)) return false;
  if (/^(THE END|CONTINUED|MORE|\(MORE\))/.test(upper)) return false;
  if (/^(TITLE:|SUPER:|CHYRON:|CARD:|INSERT:|INTERCUT)/.test(upper)) return false;
  if (/^(FLASHBACK|END FLASHBACK|BACK TO|RESUME|ANGLE ON|CLOSE ON|WIDE ON|POV)/.test(upper)) return false;
  if (/^(LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)/.test(upper)) return false;
  if (/^(SUPERIMPOSE|SUBTITLE|CAPTION)/.test(upper)) return false;

  // Action line patterns
  if (/^(A |AN |THE |HE |SHE |THEY |WE |IT |HIS |HER |THEIR )/.test(upper)) return false;
  if (/\.$/.test(upper)) return false;
  if (/^\d+[A-Z]?\s+/.test(upper)) return false;

  const words = upper.split(/\s+/);
  if (words.length > 4) return false;

  // Single word: check blacklist
  if (words.length === 1 && NON_CHARACTER_WORDS.has(upper)) return false;

  // Single word: check non-name suffixes (6+ chars)
  if (words.length === 1 && upper.length >= 6) {
    if (/^[A-Z]+(ING|ED|LY|TION|SION|NESS|MENT|ABLE|IBLE|ICAL|IOUS|EOUS|ULAR|TERN|ERN|WARD|WARDS|LIKE|LESS|FUL|IC|AL|ARY|ORY|IVE|OUS|ANT|ENT)$/.test(upper)) {
      return false;
    }
  }

  // Multi-word: all words in blacklist → reject
  if (words.length >= 2 && words.every((w) => NON_CHARACTER_WORDS.has(w))) return false;

  // Multi-word: known non-character phrases
  if (NON_CHARACTER_PHRASES.has(upper)) return false;

  return true;
}

function toTitleCase(name: string): string {
  return name
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Styles ──────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '16px',
    border: '1px solid #3a3a3a',
    width: '560px',
    maxWidth: '95vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #3a3a3a',
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  body: {
    padding: '24px 20px',
    flex: 1,
    overflow: 'auto',
  },
  dropZone: {
    border: '2px dashed rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '48px 24px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  browseBtn: {
    padding: '8px 24px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  progressView: {
    padding: '12px 0',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: '14px',
  },
  progressTrack: {
    width: '100%',
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #C9A962, #d4b97a)',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  charList: {
    flex: 1,
    overflow: 'auto',
    maxHeight: '340px',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  charRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    gap: '10px',
  },
  checkbox: {
    fontSize: '16px',
    color: '#C9A962',
    flexShrink: 0,
    width: '20px',
  },
  charName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
  },
  roleBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 500,
    flexShrink: 0,
  },
  sceneCount: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
    minWidth: '60px',
    textAlign: 'right' as const,
  },
  confirmFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '12px',
    borderTop: '1px solid #3a3a3a',
  },
  smallBtn: {
    padding: '5px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  goldBtn: {
    padding: '8px 20px',
    background: '#C9A962',
    border: 'none',
    borderRadius: '8px',
    color: '#1a1a1a',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  completeView: {
    textAlign: 'center' as const,
    padding: '40px 0',
    color: '#34d399',
  },
  errorView: {
    textAlign: 'center' as const,
    padding: '40px 0',
    color: '#ef4444',
  },
};
