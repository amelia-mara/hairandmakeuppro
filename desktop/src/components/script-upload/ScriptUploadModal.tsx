import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from '@/components/ui/Modal';
import { DropZone } from './DropZone';
import { ProcessingProgress } from './ProcessingProgress';
import { CharacterConfirmation } from './CharacterConfirmation';
import { processScriptPDF, type UploadProgress } from '@/services/pdfService';
import { classifyCharacters, type DetectedCharacter } from '@/utils/characterDetector';
import { classifyRole } from '@/utils/scriptParser';
import type { ParsedScript, Scene, Character } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

type Step = 'upload' | 'processing' | 'characters';

export function ScriptUploadModal() {
  const showModal = useUIStore((s) => s.showScriptUpload);
  const setShowModal = useUIStore((s) => s.setShowScriptUpload);
  const createProject = useProjectStore((s) => s.createProject);
  const setView = useUIStore((s) => s.setView);

  const [step, setStep] = useState<Step>('upload');
  const [progress, setProgress] = useState<UploadProgress>({ stage: 'idle', message: '' });
  const [parsedScript, setParsedScript] = useState<ParsedScript | null>(null);
  const [detectedCharacters, setDetectedCharacters] = useState<DetectedCharacter[]>([]);

  const handleClose = useCallback(() => {
    setShowModal(false);
    setStep('upload');
    setProgress({ stage: 'idle', message: '' });
    setParsedScript(null);
    setDetectedCharacters([]);
  }, [setShowModal]);

  const handleFile = useCallback(async (file: File) => {
    setStep('processing');

    try {
      const result = await processScriptPDF(file, setProgress);
      setParsedScript(result);

      const classified = classifyCharacters(result.characters, result.scenes.length);
      setDetectedCharacters(classified);
      setStep('characters');
    } catch {
      // Error is shown via progress state
    }
  }, []);

  const handleConfirmCharacters = useCallback((selectedNames: string[]) => {
    if (!parsedScript) return;

    // Convert parsed scenes to Scene type
    const scenes: Scene[] = parsedScript.scenes.map((ps, index) => ({
      id: uuidv4(),
      number: parseInt(ps.sceneNumber, 10) || index + 1,
      heading: ps.slugline,
      content: ps.content,
      intExt: ps.intExt,
      location: ps.location,
      timeOfDay: ps.timeOfDay,
      characters: ps.characters.filter((c) => selectedNames.includes(c)),
    }));

    // Convert to Character type
    const characters: Character[] = selectedNames.map((name) => {
      const parsed = parsedScript.characters.find((c) => c.name === name);
      const sceneCount = parsed?.sceneCount || 0;
      const sceneNums = parsed?.scenes.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)) || [];

      return {
        id: uuidv4(),
        name,
        roleType: classifyRole(sceneCount, parsedScript.scenes.length),
        sceneCount,
        scenes: sceneNums,
        looks: [],
      };
    });

    const title = parsedScript.title || 'Untitled Script';
    createProject(title, parsedScript.rawText, scenes, characters);
    setView('breakdown');
    handleClose();
  }, [parsedScript, createProject, setView, handleClose]);

  return (
    <Modal
      isOpen={showModal}
      onClose={handleClose}
      title={
        step === 'upload' ? 'Import Script' :
        step === 'processing' ? 'Processing Script' :
        'Confirm Characters'
      }
      size={step === 'characters' ? 'lg' : 'md'}
    >
      {step === 'upload' && <DropZone onFile={handleFile} />}
      {step === 'processing' && <ProcessingProgress progress={progress} />}
      {step === 'characters' && (
        <CharacterConfirmation
          characters={detectedCharacters}
          onConfirm={handleConfirmCharacters}
          onBack={() => setStep('upload')}
        />
      )}
    </Modal>
  );
}
