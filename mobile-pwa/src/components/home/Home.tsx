import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useAuthStore } from '@/stores/authStore';
import {
  parseScriptFile,
  parseScenesFast,
  convertParsedScriptToProject,
  suggestCharacterMerges,
  detectCharactersForScenesBatch,
} from '@/utils/scriptParser';
import {
  parseScheduleStage1,
} from '@/utils/scheduleParser';
import { saveInitialProjectData } from '@/services/supabaseProjects';
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import { useSyncStore } from '@/stores/syncStore';
import type { ParsedScript } from '@/utils/scriptParser';
import type { Project, Scene, ProductionSchedule } from '@/types';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';

type HomeView = 'upload' | 'processing' | 'characters' | 'setup';

// Enable the new progressive workflow
const USE_PROGRESSIVE_WORKFLOW = true;

interface HomeProps {
  onProjectReady: () => void;
  onBack?: () => void;
}

export function Home({ onProjectReady, onBack }: HomeProps) {
  // Skip welcome screen and go directly to upload
  const [view, setView] = useState<HomeView>('upload');
  const [projectName, setProjectName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedScheduleFile, setUploadedScheduleFile] = useState<File | null>(null);
  // parsedSchedule stored for potential future use in setup screen
  const [, setParsedSchedule] = useState<ProductionSchedule | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('Reading document...');
  const [parsedScript, setParsedScript] = useState<ParsedScript | null>(null);
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [mergeMap, setMergeMap] = useState<Map<string, string>>(new Map()); // maps merged -> primary
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scheduleInputRef = useRef<HTMLInputElement>(null);
  const { setProject, currentProject } = useProjectStore();
  const { setSchedule } = useScheduleStore();

  // Progressive workflow: Fast scene parsing then background character detection
  const processScriptFast = useCallback(async (file: File, scheduleFile?: File | null) => {
    try {
      setProcessingProgress(10);
      setProcessingStatus('Reading script...');

      // Small delay to show initial state
      await new Promise(r => setTimeout(r, 200));

      // Parse schedule if provided - extracts cast list for character identification
      let schedule: ProductionSchedule | null = null;
      if (scheduleFile) {
        setProcessingProgress(15);
        setProcessingStatus('Processing schedule...');
        try {
          const result = await parseScheduleStage1(scheduleFile);
          schedule = result.schedule;
          setParsedSchedule(schedule);
          setSchedule(schedule);
        } catch {
          // Schedule parsing is optional, continue without it
        }
      }

      setProcessingProgress(30);
      setProcessingStatus('Detecting scenes...');

      // Fast parse - only extracts scene structure
      const fastParsed = await parseScenesFast(file);

      setProcessingProgress(70);
      setProcessingStatus('Creating project...');
      await new Promise(r => setTimeout(r, 100));

      // Create project immediately with scenes
      const scenes: Scene[] = fastParsed.scenes.map((fs) => {
        return {
          id: uuidv4(),
          sceneNumber: fs.sceneNumber,
          slugline: fs.slugline,
          intExt: fs.intExt,
          timeOfDay: fs.timeOfDay,
          scriptContent: fs.scriptContent,
          characters: [], // Empty until confirmed
          isComplete: false,
          characterConfirmationStatus: 'pending' as const,
          suggestedCharacters: undefined,
          shootingDay: undefined,
        };
      });

      // Use existing project ID if available (preserves server UUID when needsSetup was true)
      // Otherwise create a new local ID
      const projectId = currentProject?.id || uuidv4();
      const projectNameToUse = projectName || currentProject?.name || fastParsed.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled Project';

      // Encode PDF to base64 BEFORE setProject so scriptPdfData is available
      // when startSync → pushInitialData reads the store. Previously, encoding
      // happened after setProject, creating a race where pushInitialData could
      // read the store before scriptPdfData was set.
      let scriptPdfBase64: string | undefined;
      if (file.type === 'application/pdf') {
        scriptPdfBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const project: Project = {
        id: projectId,
        name: projectNameToUse,
        createdAt: currentProject?.createdAt || new Date(),
        updatedAt: new Date(),
        scenes,
        characters: currentProject?.characters || [],
        looks: currentProject?.looks || [],
        characterDetectionStatus: 'idle', // Will be updated when detection runs
        scenesConfirmed: 0,
        scriptPdfData: scriptPdfBase64,
      };

      setProcessingProgress(90);
      setProcessingStatus('Almost done...');
      await new Promise(r => setTimeout(r, 200));

      setProcessingProgress(100);
      setProcessingStatus('Complete!');

      // Set the project locally — suppress auto-save since saveInitialProjectData
      // handles the first write to Supabase (avoids delete+insert race).
      setReceivingFromServer(true);
      setProject(project);
      setReceivingFromServer(false);

      // ── Save directly to Supabase ──────────────────────────────
      // Await this so data is on the server before user navigates away.
      const userId = useAuthStore.getState().user?.id || null;
      const saveResult = await saveInitialProjectData({
        projectId,
        userId,
        scenes: scenes.map(s => ({
          id: s.id,
          scene_number: s.sceneNumber,
          int_ext: s.intExt || null,
          location: s.slugline || null,
          time_of_day: s.timeOfDay || null,
          synopsis: null,
          script_content: s.scriptContent || null,
          shooting_day: s.shootingDay || null,
          is_complete: false,
        })),
        schedule: schedule ? {
          id: schedule.id,
          rawText: schedule.rawText || null,
          castList: schedule.castList,
          days: schedule.days,
          status: schedule.status,
          pdfDataUri: schedule.pdfUri,
        } : null,
        scriptPdfDataUri: scriptPdfBase64,
      });
      if (saveResult.error) {
        console.error('[Home] Failed to save project data to server:', saveResult.error);
      } else {
        useSyncStore.getState().clearChanges();
        useSyncStore.getState().setUploaded();
      }

      // Always run character detection
      // If schedule is provided, use cast list for accurate character identification
      // Otherwise, use regex detection to find character names
      const castListNames = schedule?.castList?.map(c => c.name) || [];
      setTimeout(() => {
        startBackgroundCharacterDetection(project, fastParsed.rawText, castListNames, projectId, userId);
      }, 500);

      // Go directly to app
      setTimeout(() => onProjectReady(), 500);
    } catch (error) {
      console.error('Script parsing error:', error);
      alert(error instanceof Error ? error.message : 'Failed to parse script');
      setView('upload');
    }
  }, [projectName, setProject, setSchedule, onProjectReady, currentProject]);

  // Background character detection (runs after project is created)
  // If knownCharacters is provided (from schedule), use it for accurate detection
  const startBackgroundCharacterDetection = useCallback(async (
    project: Project,
    rawText: string,
    knownCharacters: string[] = [],
    projectId?: string,
    userId?: string | null,
  ) => {
    try {
      // Mark detection as running
      useProjectStore.getState().startCharacterDetection();

      // Prepare scenes for batch detection
      const scenesToDetect = project.scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        scriptContent: s.scriptContent || '',
      }));

      // Detect characters in batches
      const results = await detectCharactersForScenesBatch(
        scenesToDetect,
        rawText,
        {
          useAI: false, // Use regex only for fast initial detection
          knownCharacters: knownCharacters.length > 0 ? knownCharacters : undefined,
          onProgress: () => {},
        }
      );

      // Update each scene with suggested characters
      // Use current store state to avoid stale closure on `project` parameter
      const store = useProjectStore.getState();
      const currentScenes = store.currentProject?.scenes || project.scenes;
      results.forEach((characters, sceneNumber) => {
        const scene = currentScenes.find((s) => s.sceneNumber === sceneNumber);
        if (scene) {
          store.updateSceneSuggestedCharacters(scene.id, characters);
        }
      });

      // Mark detection as complete
      store.setCharacterDetectionStatus('complete');

      // ── Save detected characters to Supabase ─────────────────
      // After detection, the store now has characters and scene_characters.
      // Push them to the server so they're available on re-login.
      const pid = projectId || store.currentProject?.id;
      if (pid) {
        const updatedProject = useProjectStore.getState().currentProject;
        if (updatedProject && updatedProject.characters.length > 0) {
          saveInitialProjectData({
            projectId: pid,
            userId: userId ?? null,
            scenes: [], // already saved
            characters: updatedProject.characters.map(c => ({
              id: c.id,
              name: c.name,
              initials: c.initials,
              avatar_colour: c.avatarColour || '#C9A961',
            })),
            sceneCharacters: updatedProject.scenes.flatMap(s =>
              s.characters.map(charId => ({ scene_id: s.id, character_id: charId }))
            ),
          }).then(({ error: saveErr }) => {
            if (saveErr) {
              console.error('[Home] Failed to save characters to server:', saveErr);
            }
          });
        }
      }
    } catch (error) {
      console.error('Background character detection failed:', error);
      // Still mark as complete so user can manually add characters
      useProjectStore.getState().setCharacterDetectionStatus('complete');
    }
  }, []);

  // Original workflow: Full AI parsing then character selection
  const processScript = useCallback(async (file: File, scheduleFile?: File | null) => {
    // Use progressive workflow if enabled
    if (USE_PROGRESSIVE_WORKFLOW) {
      return processScriptFast(file, scheduleFile);
    }

    // Legacy flow
    try {
      setProcessingProgress(10);
      setProcessingStatus('Reading document...');

      // Small delay to show initial state
      await new Promise(r => setTimeout(r, 300));

      // Progress tracking for AI parsing
      let lastProgress = 10;
      const onProgress = (status: string) => {
        setProcessingStatus(status);
        // Increment progress based on status
        if (status.includes('Checking AI')) {
          lastProgress = 20;
        } else if (status.includes('Analyzing script with AI')) {
          lastProgress = 30;
        } else if (status.includes('Analyzing script section')) {
          // Extract section number for progress
          const match = status.match(/section (\d+) of (\d+)/);
          if (match) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            lastProgress = 30 + Math.round((current / total) * 50);
          }
        } else if (status.includes('Script analysis complete') || status.includes('Complete')) {
          lastProgress = 90;
        } else if (status.includes('standard parsing') || status.includes('Parsing script')) {
          lastProgress = 40;
        } else if (status.includes('unavailable')) {
          lastProgress = 25;
        }
        setProcessingProgress(lastProgress);
      };

      // Parse with AI support
      const parsed = await parseScriptFile(file, {
        useAI: true,
        onProgress,
      });

      setProcessingProgress(95);
      setProcessingStatus('Finalizing...');
      await new Promise(r => setTimeout(r, 200));

      setProcessingProgress(100);
      setProcessingStatus('Complete!');

      setParsedScript(parsed);

      // Auto-select top characters (by scene count)
      const topCharacters = parsed.characters
        .filter(c => c.sceneCount >= 1)
        .slice(0, 20) // Reasonable limit
        .map(c => c.name);
      setSelectedCharacters(new Set(topCharacters));

      // Check for merge suggestions
      const suggestions = suggestCharacterMerges(parsed.characters);
      const newMergeMap = new Map<string, string>();
      suggestions.forEach(s => {
        s.similar.forEach(sim => newMergeMap.set(sim, s.primary));
      });
      setMergeMap(newMergeMap);

      // Move to character selection view
      setTimeout(() => setView('characters'), 500);
    } catch (error) {
      console.error('Script parsing error:', error);
      // Show error and return to upload
      alert(error instanceof Error ? error.message : 'Failed to parse script');
      setView('upload');
    }
  }, [processScriptFast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Extract project name from filename
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setProjectName(name);
      // Don't auto-process - let user click Continue after uploading all files
    }
  };

  const handleScheduleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedScheduleFile(file);
    }
  };

  const handleStartWithFiles = () => {
    if (uploadedFile) {
      setView('processing');
      processScript(uploadedFile, uploadedScheduleFile);
    }
  };

  const handleStartProject = () => {
    if (!parsedScript) {
      // No script parsed - create empty project
      const emptyProject: Project = {
        id: uuidv4(),
        name: projectName || 'Untitled Project',
        createdAt: new Date(),
        updatedAt: new Date(),
        scenes: [],
        characters: [],
        looks: [],
      };
      setProject(emptyProject);
      onProjectReady();
      return;
    }

    // Apply merges to character selection
    const finalCharacters = Array.from(selectedCharacters).filter(name => {
      // If this character is merged into another, exclude it
      return !mergeMap.has(name);
    });

    // Convert parsed script to project
    const { scenes, characters } = convertParsedScriptToProject(parsedScript, finalCharacters);

    // Create empty looks for each character
    const looks = characters.map((char) => ({
      id: uuidv4(),
      characterId: char.id,
      name: 'Look 1',
      scenes: scenes.filter(s => s.characters.includes(char.id)).map(s => s.sceneNumber),
      estimatedTime: 30,
      makeup: createEmptyMakeupDetails(),
      hair: createEmptyHairDetails(),
    }));

    // Use existing project ID if available (preserves server UUID when needsSetup was true)
    const projectId = currentProject?.id || `project-${Date.now()}`;
    const projectNameToUse = projectName || currentProject?.name || parsedScript.title || 'Untitled Project';

    const project: Project = {
      id: projectId,
      name: projectNameToUse,
      createdAt: currentProject?.createdAt || new Date(),
      updatedAt: new Date(),
      scenes,
      characters,
      looks,
    };

    setProject(project);
    onProjectReady();
  };

  const handleSkipToSetup = () => {
    setParsedScript(null);
    setSelectedCharacters(new Set());
    setView('setup');
  };

  const handleToggleCharacter = (name: string) => {
    setSelectedCharacters(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleMergeCharacter = (from: string, into: string) => {
    setMergeMap(prev => {
      const next = new Map(prev);
      if (from === into) {
        next.delete(from);
      } else {
        next.set(from, into);
      }
      return next;
    });
    // Ensure primary is selected
    setSelectedCharacters(prev => {
      const next = new Set(prev);
      next.add(into);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {view === 'upload' && (
        <UploadScreen
          fileInputRef={fileInputRef}
          scheduleInputRef={scheduleInputRef}
          uploadedFile={uploadedFile}
          uploadedScheduleFile={uploadedScheduleFile}
          onBack={onBack}
          onSkip={handleSkipToSetup}
          onStartWithFiles={handleStartWithFiles}
        />
      )}

      {view === 'processing' && (
        <ProcessingScreen
          fileName={uploadedFile?.name || ''}
          progress={processingProgress}
          status={processingStatus}
        />
      )}

      {view === 'characters' && parsedScript && (
        <CharacterSelectionScreen
          parsedScript={parsedScript}
          selectedCharacters={selectedCharacters}
          mergeMap={mergeMap}
          onToggleCharacter={handleToggleCharacter}
          onMergeCharacter={handleMergeCharacter}
          onContinue={() => setView('setup')}
          onBack={() => setView('upload')}
        />
      )}

      {view === 'setup' && (
        <SetupScreen
          projectName={projectName}
          onNameChange={setProjectName}
          detectedScenes={parsedScript?.scenes.length || 0}
          detectedCharacters={Array.from(selectedCharacters).filter(name => !mergeMap.has(name))}
          onStart={handleStartProject}
          onBack={() => parsedScript ? setView('characters') : setView('upload')}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.fdx,.fountain,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={scheduleInputRef}
        type="file"
        accept=".pdf"
        onChange={handleScheduleSelect}
        className="hidden"
      />
    </div>
  );
}

// Upload Screen
interface UploadScreenProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  scheduleInputRef: React.RefObject<HTMLInputElement>;
  uploadedFile: File | null;
  uploadedScheduleFile: File | null;
  onBack?: () => void;
  onSkip: () => void;
  onStartWithFiles: () => void;
}

function UploadScreen({
  fileInputRef,
  scheduleInputRef,
  uploadedFile,
  uploadedScheduleFile,
  onBack,
  onSkip,
  onStartWithFiles,
}: UploadScreenProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-text-muted active:text-gold transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-semibold text-text-primary">Upload Files</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Script Upload (Required) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-text-primary">Script</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold">Required</span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`w-full rounded-2xl border-2 border-dashed transition-colors p-6 ${
              uploadedFile
                ? 'border-green-400 bg-green-50'
                : 'border-gold/40 bg-gold/5 active:bg-gold/10'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                uploadedFile ? 'bg-green-100' : 'bg-gold/10'
              }`}>
                {uploadedFile ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-left">
                {uploadedFile ? (
                  <>
                    <p className="text-sm font-medium text-green-700 truncate">{uploadedFile.name}</p>
                    <p className="text-xs text-green-600">Tap to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-text-primary">Tap to upload script</p>
                    <p className="text-xs text-text-muted">PDF, Final Draft, or Fountain</p>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Schedule Upload (Optional) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-text-primary">Production Schedule</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-text-muted">Optional</span>
          </div>
          <button
            onClick={() => scheduleInputRef.current?.click()}
            className={`w-full rounded-2xl border-2 border-dashed transition-colors p-6 ${
              uploadedScheduleFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 bg-gray-50 active:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                uploadedScheduleFile ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {uploadedScheduleFile ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-left">
                {uploadedScheduleFile ? (
                  <>
                    <p className="text-sm font-medium text-green-700 truncate">{uploadedScheduleFile.name}</p>
                    <p className="text-xs text-green-600">Tap to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-text-secondary">Tap to upload schedule</p>
                    <p className="text-xs text-text-muted">PDF (strips, one-liner)</p>
                  </>
                )}
              </div>
            </div>
          </button>
          <p className="text-xs text-text-light mt-2 px-2">
            Uploading a schedule gives you accurate character assignments per scene and shooting day info
          </p>
        </div>

        {/* Info */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-1">Faster with Schedule</p>
              <p>The schedule contains the official cast list with character numbers. This allows instant, accurate character detection per scene without AI processing.</p>
            </div>
          </div>
        </div>

        {/* Background processing note */}
        <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-text-secondary">
              <p className="font-medium mb-1">Background Processing</p>
              <p>The schedule will process automatically in the background. Character assignments will be confirmed within a few minutes - you can start using the app right away.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-8 pt-4 border-t border-border space-y-3">
        <button
          onClick={onStartWithFiles}
          disabled={!uploadedFile}
          className="w-full py-4 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          {uploadedFile ? 'Start Processing' : 'Upload a script to continue'}
        </button>
        <button
          onClick={onSkip}
          className="py-3 text-sm text-text-muted font-medium active:text-gold transition-colors"
        >
          Skip - add manually
        </button>
      </div>
    </div>
  );
}

// Processing Screen
interface ProcessingScreenProps {
  fileName: string;
  progress: number;
  status: string;
}

function ProcessingScreen({ fileName, progress, status }: ProcessingScreenProps) {
  const isProgressiveWorkflow = USE_PROGRESSIVE_WORKFLOW;

  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-6">
      <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-gold animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>

      <h2 className="text-lg font-semibold text-text-primary mb-2">Processing Script</h2>
      <p className="text-sm text-text-muted mb-6 truncate max-w-full">{fileName}</p>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gold rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-text-light text-center mb-4">
          {status}
        </p>

        {/* Informative note - adjusted for progressive workflow */}
        <p className="text-sm text-text-muted text-center leading-relaxed">
          {isProgressiveWorkflow
            ? "Detecting scenes in your script. You'll be able to confirm characters scene-by-scene."
            : "This may take a few minutes. We're carefully analyzing your script to accurately capture all scenes and characters."}
        </p>
      </div>
    </div>
  );
}

// Character Selection Screen
interface CharacterSelectionScreenProps {
  parsedScript: ParsedScript;
  selectedCharacters: Set<string>;
  mergeMap: Map<string, string>;
  onToggleCharacter: (name: string) => void;
  onMergeCharacter: (from: string, into: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

function CharacterSelectionScreen({
  parsedScript,
  selectedCharacters,
  mergeMap,
  onToggleCharacter,
  onMergeCharacter,
  onContinue,
  onBack,
}: CharacterSelectionScreenProps) {
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);

  // Characters sorted by scene count, with merge info
  const sortedCharacters = [...parsedScript.characters].sort((a, b) => b.sceneCount - a.sceneCount);

  const handleMergeClick = (charName: string) => {
    setMergeTarget(charName);
    setShowMergeModal(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-text-muted active:text-gold transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Select Characters</h1>
      </div>

      {/* Summary */}
      <div className="px-6 py-4 bg-gold/5 border-b border-border">
        <div className="flex justify-around text-center">
          <div>
            <p className="text-2xl font-bold text-gold">{parsedScript.scenes.length}</p>
            <p className="text-xs text-text-muted">Scenes</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gold">{parsedScript.characters.length}</p>
            <p className="text-xs text-text-muted">Characters Found</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gold">{selectedCharacters.size - mergeMap.size}</p>
            <p className="text-xs text-text-muted">Selected</p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="px-6 py-3">
        <p className="text-sm text-text-muted">
          Select the characters you want to track. Tap the merge icon to combine similar characters.
        </p>
      </div>

      {/* Character list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-2">
          {sortedCharacters.map((char) => {
            const isSelected = selectedCharacters.has(char.name);
            const mergedInto = mergeMap.get(char.name);
            const isMerged = !!mergedInto;

            return (
              <div
                key={char.name}
                className={`rounded-xl border transition-all ${
                  isMerged
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : isSelected
                    ? 'border-gold bg-gold/5'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => !isMerged && onToggleCharacter(char.name)}
                    disabled={isMerged}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      isMerged
                        ? 'border-gray-300 bg-gray-200'
                        : isSelected
                        ? 'border-gold bg-gold'
                        : 'border-gray-300'
                    }`}
                  >
                    {(isSelected || isMerged) && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Character info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${isMerged ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {char.name}
                      </span>
                      {isMerged && (
                        <span className="text-xs text-text-muted">
                          → {mergedInto}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {char.sceneCount} scene{char.sceneCount !== 1 ? 's' : ''}
                      {char.variants.length > 1 && ` • ${char.variants.length} variants`}
                    </p>
                  </div>

                  {/* Merge button */}
                  {!isMerged && (
                    <button
                      onClick={() => handleMergeClick(char.name)}
                      className="p-2 text-text-muted hover:text-gold transition-colors"
                      title="Merge with another character"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Continue button */}
      <div className="px-6 pb-8 pt-4 border-t border-border">
        <button
          onClick={onContinue}
          disabled={selectedCharacters.size - mergeMap.size === 0}
          className="w-full py-4 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          Continue with {selectedCharacters.size - mergeMap.size} Character{selectedCharacters.size - mergeMap.size !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Merge Modal */}
      {showMergeModal && mergeTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[70vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Merge "{mergeTarget}" into...</h3>
              <button
                onClick={() => setShowMergeModal(false)}
                className="p-2 text-text-muted"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {/* Option to unmerge */}
                {mergeMap.has(mergeTarget) && (
                  <button
                    onClick={() => {
                      onMergeCharacter(mergeTarget, mergeTarget);
                      setShowMergeModal(false);
                    }}
                    className="w-full p-3 text-left rounded-lg border border-red-200 bg-red-50 text-red-700"
                  >
                    <span className="font-medium">Remove merge</span>
                    <span className="text-sm text-red-500 block">Keep as separate character</span>
                  </button>
                )}
                {sortedCharacters
                  .filter(c => c.name !== mergeTarget && !mergeMap.has(c.name))
                  .map(char => (
                    <button
                      key={char.name}
                      onClick={() => {
                        onMergeCharacter(mergeTarget, char.name);
                        setShowMergeModal(false);
                      }}
                      className="w-full p-3 text-left rounded-lg border border-border bg-card hover:border-gold transition-colors"
                    >
                      <span className="font-medium text-text-primary">{char.name}</span>
                      <span className="text-xs text-text-muted block">{char.sceneCount} scenes</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Setup Screen
interface SetupScreenProps {
  projectName: string;
  onNameChange: (name: string) => void;
  detectedScenes: number;
  detectedCharacters: string[];
  onStart: () => void;
  onBack: () => void;
}

function SetupScreen({
  projectName,
  onNameChange,
  detectedScenes,
  detectedCharacters,
  onStart,
  onBack,
}: SetupScreenProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-text-muted active:text-gold transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Project Setup</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        {/* Project name */}
        <div className="mb-6">
          <label className="field-label block mb-2">Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Enter project name"
            className="input-field w-full text-base"
          />
        </div>

        {/* Detection results */}
        {(detectedScenes > 0 || detectedCharacters.length > 0) && (
          <div className="space-y-4">
            <h3 className="section-header">DETECTED FROM SCRIPT</h3>

            {detectedScenes > 0 && (
              <div className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.875 1.875 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-text-primary">Scenes</span>
                </div>
                <span className="text-lg font-bold text-gold">{detectedScenes}</span>
              </div>
            )}

            {detectedCharacters.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-text-primary">Characters</span>
                  <span className="ml-auto text-lg font-bold text-gold">{detectedCharacters.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detectedCharacters.map((char) => (
                    <span
                      key={char}
                      className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-text-secondary"
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {detectedScenes === 0 && detectedCharacters.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-sm text-text-muted mb-2">No script uploaded</p>
            <p className="text-xs text-text-light">
              You can add scenes and characters manually after setup
            </p>
          </div>
        )}
      </div>

      {/* Start button */}
      <div className="px-6 pb-8">
        <button
          onClick={onStart}
          disabled={!projectName.trim()}
          className="w-full py-4 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          Start Project
        </button>
      </div>
    </div>
  );
}
