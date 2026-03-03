import { useState, useCallback, useRef } from 'react';
import { FileText, Upload, AlertCircle } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { Modal, Button, Progress, Checkbox, Badge } from '@/components/ui';
import { extractTextFromPDF } from '@/services/pdfService';
import { parseScript } from '@/services/parserService';
import type { Scene, Character, DetectedCharacter, RoleType } from '@/types';

interface ScriptUploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (scenes: Scene[], characters: Character[]) => void;
}

type Stage = 'upload' | 'processing' | 'confirmation';

interface ProcessingStatus {
  progress: number;
  message: string;
}

const ROLE_LABELS: Record<RoleType, string> = {
  lead: 'Lead',
  supporting: 'Supporting',
  day_player: 'Day Player',
  extra: 'Extra',
};

export function ScriptUploadModal({ open, onClose, onComplete }: ScriptUploadModalProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState<ProcessingStatus>({ progress: 0, message: '' });
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [detectedCharacters, setDetectedCharacters] = useState<DetectedCharacter[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStage('upload');
    setDragOver(false);
    setProcessing({ progress: 0, message: '' });
    setScenes([]);
    setDetectedCharacters([]);
    setWarnings([]);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.');
      return;
    }

    setError(null);
    setStage('processing');

    try {
      // Stage 1: Extract text from PDF
      setProcessing({ progress: 10, message: 'Extracting text...' });
      const result = await extractTextFromPDF(file, (pdfProgress) => {
        setProcessing({
          progress: 10 + (pdfProgress * 0.4),
          message: 'Extracting text...',
        });
      });

      // Stage 2: Detect scenes
      setProcessing({ progress: 55, message: 'Detecting scenes...' });
      await new Promise((r) => setTimeout(r, 300));

      // Stage 3: Find characters
      setProcessing({ progress: 75, message: 'Finding characters...' });
      await new Promise((r) => setTimeout(r, 300));

      const parseResult = parseScript(result.text);

      setProcessing({ progress: 100, message: 'Complete!' });
      await new Promise((r) => setTimeout(r, 400));

      setScenes(parseResult.scenes);
      setWarnings(parseResult.warnings);

      // Default: extras are unchecked, others are checked
      const chars = parseResult.characters.map((c) => ({
        ...c,
        selected: c.roleType !== 'extra',
      }));
      setDetectedCharacters(chars);

      setStage('confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process script.');
      setStage('upload');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleToggleCharacter = useCallback((index: number) => {
    setDetectedCharacters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  }, []);

  const handleConfirm = useCallback(() => {
    const selectedCharacters: Character[] = detectedCharacters
      .filter((c) => c.selected)
      .map((dc) => ({
        id: uuid(),
        name: dc.name,
        aliases: [],
        roleType: dc.roleType,
        sceneCount: dc.sceneCount,
        sceneNumbers: dc.sceneNumbers,
        firstAppearance: dc.sceneNumbers.length > 0 ? Math.min(...dc.sceneNumbers) : 0,
        lastAppearance: dc.sceneNumbers.length > 0 ? Math.max(...dc.sceneNumbers) : 0,
      }));

    onComplete(scenes, selectedCharacters);
    resetState();
  }, [detectedCharacters, scenes, onComplete, resetState]);

  const renderUploadStage = () => (
    <div className="flex flex-col items-center gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`w-full border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 transition-colors-fast cursor-pointer
          ${dragOver
            ? 'border-gold bg-gold-muted'
            : 'border-border-default hover:border-border-strong'
          }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center">
          <FileText className="w-8 h-8 text-text-muted" />
        </div>
        <div className="text-center">
          <p className="text-text-primary font-medium">Drop your script PDF here</p>
          <p className="text-sm text-text-muted mt-1">or click to browse files</p>
        </div>
        <Button variant="secondary" size="sm" icon={<Upload className="w-4 h-4" />}>
          Browse files
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && (
        <div className="flex items-center gap-2 text-error text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  const renderProcessingStage = () => (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="w-16 h-16 rounded-2xl bg-gold-muted flex items-center justify-center">
        <FileText className="w-8 h-8 text-gold animate-pulse" />
      </div>
      <div className="w-full max-w-xs space-y-3">
        <Progress value={processing.progress} size="md" />
        <p className="text-sm text-text-secondary text-center">{processing.message}</p>
      </div>
    </div>
  );

  const renderConfirmationStage = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Detected <span className="text-text-primary font-medium">{scenes.length}</span> scenes
          and <span className="text-text-primary font-medium">{detectedCharacters.length}</span> characters
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-warning flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="border border-border-default rounded-lg divide-y divide-border-subtle max-h-[360px] overflow-y-auto">
        {detectedCharacters.map((char, index) => (
          <label
            key={char.name}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors-fast cursor-pointer"
          >
            <Checkbox
              checked={char.selected}
              onChange={() => handleToggleCharacter(index)}
            />
            <div className="flex-1 min-w-0">
              <span className="text-text-primary font-medium">{char.name}</span>
            </div>
            <span className="text-xs text-text-muted whitespace-nowrap">
              {char.sceneCount} {char.sceneCount === 1 ? 'scene' : 'scenes'}
            </span>
            <Badge variant={char.roleType}>{ROLE_LABELS[char.roleType]}</Badge>
          </label>
        ))}
      </div>
    </div>
  );

  const title =
    stage === 'upload'
      ? 'Upload Script'
      : stage === 'processing'
        ? 'Processing Script'
        : 'Confirm Characters';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      maxWidth="max-w-lg"
      footer={
        stage === 'confirmation' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Confirm &amp; Continue</Button>
          </>
        ) : undefined
      }
    >
      {stage === 'upload' && renderUploadStage()}
      {stage === 'processing' && renderProcessingStage()}
      {stage === 'confirmation' && renderConfirmationStage()}
    </Modal>
  );
}
