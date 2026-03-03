import { useState, useCallback, useMemo } from 'react';
import { useBreakdownStore } from '../stores/breakdownStore';
import ScriptUploader from '../components/breakdown/ScriptUploader';
import CharacterConfirmation from '../components/breakdown/CharacterConfirmation';
import SceneList from '../components/breakdown/SceneList';
import CharacterTabs from '../components/breakdown/CharacterTabs';
import ScriptView from '../components/breakdown/ScriptView';
import CharacterProfile from '../components/breakdown/CharacterProfile';
import SceneBreakdownPanel from '../components/breakdown/SceneBreakdownPanel';
import { parseScriptFile, parseScriptText } from '../utils/scriptParser';
import { detectCharactersWithAI, checkAIAvailability } from '../services/aiService';

export default function ScriptBreakdown() {
  const {
    currentStep,
    scenes,
    characters,
    selectedSceneId,
    selectedCharacterId,
    setScript,
    setCharacters,
    confirmCharacters,
    setStep,
    selectCharacter,
    clearProject,
  } = useBreakdownStore();

  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  // ── Upload Handlers ────────────────────────────────────────────

  const handleFileSelected = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setProgressMessage('Reading document...');

      try {
        const result = await parseScriptFile(file, setProgressMessage);

        setScript(file.name, result.rawText, result.scenes);

        // If regex found characters, use them; otherwise try AI
        if (result.characters.length > 0) {
          setCharacters(result.characters);
          setStep('confirm-characters');
        } else {
          // Try AI detection
          setProgressMessage('Checking AI availability...');
          const aiAvail = await checkAIAvailability();
          if (aiAvail) {
            setProgressMessage('Detecting characters with AI...');
            const aiChars = await detectCharactersWithAI(
              result.scenes,
              result.rawText,
              setProgressMessage,
            );
            setCharacters(aiChars);
          }
          setStep('confirm-characters');
        }
      } catch (err) {
        console.error('Script parsing failed:', err);
        setProgressMessage('Failed to parse script. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [setScript, setCharacters, setStep],
  );

  const handleTextPasted = useCallback(
    (text: string) => {
      setIsLoading(true);
      setProgressMessage('Parsing script...');

      try {
        const result = parseScriptText(text);
        setScript('Pasted Script', result.rawText, result.scenes);
        setCharacters(result.characters);
        setStep('confirm-characters');
      } catch (err) {
        console.error('Script parsing failed:', err);
        setProgressMessage('Failed to parse script.');
      } finally {
        setIsLoading(false);
      }
    },
    [setScript, setCharacters, setStep],
  );

  // ── Derived State ──────────────────────────────────────────────

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  );

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId],
  );

  // ── Step: Upload ───────────────────────────────────────────────

  if (currentStep === 'upload') {
    return (
      <div className="h-full flex flex-col">
        {/* Top bar with new project option if data exists */}
        {scenes.length > 0 && (
          <div className="px-6 py-3 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-400 text-sm">
              Previous breakdown data found
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('breakdown')}
                className="px-3 py-1.5 text-sm text-gold hover:text-gold-light transition-colors"
              >
                Resume Breakdown
              </button>
              <button
                onClick={clearProject}
                className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Start Fresh
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <ScriptUploader
            onFileSelected={handleFileSelected}
            onTextPasted={handleTextPasted}
            isLoading={isLoading}
            progressMessage={progressMessage}
          />
        </div>
      </div>
    );
  }

  // ── Step: Confirm Characters ───────────────────────────────────

  if (currentStep === 'confirm-characters') {
    return (
      <CharacterConfirmation
        characters={characters}
        onConfirm={(ids) => confirmCharacters(ids)}
        onBack={() => setStep('upload')}
      />
    );
  }

  // ── Step: Breakdown (Three-Panel Layout) ───────────────────────

  return (
    <div className="flex h-full">
      {/* Left Panel: Scene List (250px) */}
      <div className="w-[250px] shrink-0 border-r border-neutral-800 bg-[#0a0a0a]">
        <SceneList />
      </div>

      {/* Center Panel: Script / Character tabs */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-neutral-800">
        {selectedScene ? (
          <>
            <CharacterTabs
              characters={characters}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={selectCharacter}
              sceneId={selectedScene.id}
            />
            <div className="flex-1 overflow-hidden">
              {selectedCharacter ? (
                <CharacterProfile character={selectedCharacter} scenes={scenes} />
              ) : (
                <ScriptView
                  scene={selectedScene}
                  characters={characters}
                  onCharacterClick={selectCharacter}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-neutral-600 text-sm">Select a scene from the left panel</p>
          </div>
        )}
      </div>

      {/* Right Panel: Scene Breakdown (350px) */}
      <div className="w-[350px] shrink-0 bg-[#0a0a0a]">
        {selectedScene ? (
          <SceneBreakdownPanel scene={selectedScene} characters={characters} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-neutral-600 text-sm">Select a scene</p>
          </div>
        )}
      </div>
    </div>
  );
}
