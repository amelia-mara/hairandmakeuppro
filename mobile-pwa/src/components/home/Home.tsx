import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { demoProject } from '@/stores/demoData';
import { parseScriptFile, convertParsedScriptToProject, suggestCharacterMerges } from '@/utils/scriptParser';
import type { ParsedScript } from '@/utils/scriptParser';
import type { Project } from '@/types';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';

type HomeView = 'welcome' | 'upload' | 'processing' | 'characters' | 'setup';

interface HomeProps {
  onProjectReady: () => void;
}

export function Home({ onProjectReady }: HomeProps) {
  const [view, setView] = useState<HomeView>('welcome');
  const [projectName, setProjectName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('Reading document...');
  const [parsedScript, setParsedScript] = useState<ParsedScript | null>(null);
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [mergeMap, setMergeMap] = useState<Map<string, string>>(new Map()); // maps merged -> primary
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setProject } = useProjectStore();

  const processScript = useCallback(async (file: File) => {
    try {
      setProcessingProgress(10);
      setProcessingStatus('Reading document...');

      // Small delay to show initial state
      await new Promise(r => setTimeout(r, 300));

      setProcessingProgress(30);
      setProcessingStatus('Parsing script format...');

      const parsed = await parseScriptFile(file);

      setProcessingProgress(60);
      setProcessingStatus('Identifying scenes...');
      await new Promise(r => setTimeout(r, 200));

      setProcessingProgress(80);
      setProcessingStatus('Detecting characters...');
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
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Extract project name from filename
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setProjectName(name);
      setView('processing');
      processScript(file);
    }
  };

  const handleStartProject = () => {
    if (!parsedScript) {
      // No script parsed - create empty project
      const emptyProject: Project = {
        id: `project-${Date.now()}`,
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
      id: `look-${char.id}`,
      characterId: char.id,
      name: 'Look 1',
      scenes: scenes.filter(s => s.characters.includes(char.id)).map(s => s.sceneNumber),
      estimatedTime: 30,
      makeup: createEmptyMakeupDetails(),
      hair: createEmptyHairDetails(),
    }));

    const project: Project = {
      id: `project-${Date.now()}`,
      name: projectName || parsedScript.title || 'Untitled Project',
      createdAt: new Date(),
      updatedAt: new Date(),
      scenes,
      characters,
      looks,
    };

    setProject(project);
    onProjectReady();
  };

  const handleLoadDemo = () => {
    setProject(demoProject);
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
      {view === 'welcome' && (
        <WelcomeScreen
          onUploadScript={() => setView('upload')}
          onLoadDemo={handleLoadDemo}
        />
      )}

      {view === 'upload' && (
        <UploadScreen
          fileInputRef={fileInputRef}
          onBack={() => setView('welcome')}
          onSkip={handleSkipToSetup}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.fdx,.fountain,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// Welcome Screen
interface WelcomeScreenProps {
  onUploadScript: () => void;
  onLoadDemo: () => void;
}

function WelcomeScreen({ onUploadScript, onLoadDemo }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Logo/Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center mb-6 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">Hair & Makeup Pro</h1>
        <p className="text-text-muted text-center max-w-xs mb-8">
          Your mobile companion for on-set continuity tracking keeping checks happy
        </p>

        {/* Features list */}
        <div className="w-full max-w-sm space-y-3 mb-8">
          <FeatureItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
            text="Import your script to auto-detect scenes & characters"
          />
          <FeatureItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            }
            text="Capture and organize continuity photos"
          />
          <FeatureItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            text="Track your hours and manage timesheets"
          />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-8 space-y-3">
        <button
          onClick={onUploadScript}
          className="w-full py-4 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform"
        >
          Upload Script
        </button>
        <button
          onClick={onLoadDemo}
          className="w-full py-3 rounded-button bg-gray-100 text-text-secondary font-medium text-sm active:scale-[0.98] transition-transform"
        >
          Try with Demo Project
        </button>
      </div>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-xl border border-border">
      <div className="text-gold">{icon}</div>
      <span className="text-sm text-text-secondary">{text}</span>
    </div>
  );
}

// Upload Screen
interface UploadScreenProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onBack: () => void;
  onSkip: () => void;
}

function UploadScreen({ fileInputRef, onBack, onSkip }: UploadScreenProps) {
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
        <h1 className="text-lg font-semibold text-text-primary">Upload Script</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-sm aspect-[4/3] rounded-2xl border-2 border-dashed border-gold/40 bg-gold/5 flex flex-col items-center justify-center gap-4 active:bg-gold/10 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-text-primary mb-1">
              Tap to upload script
            </p>
            <p className="text-sm text-text-muted">
              PDF, Final Draft, or Fountain
            </p>
          </div>
        </button>

        <p className="text-xs text-text-light mt-6 text-center max-w-xs">
          We'll automatically detect scenes and characters from your script
        </p>
      </div>

      {/* Skip option */}
      <div className="px-6 pb-8">
        <button
          onClick={onSkip}
          className="w-full py-3 text-sm text-text-muted font-medium active:text-gold transition-colors"
        >
          Skip - I'll add scenes manually
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
        <p className="text-xs text-text-light text-center">
          {status}
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
