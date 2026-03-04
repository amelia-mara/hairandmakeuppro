import { useState, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Calendar,
  Check,
  Upload,
  Sparkles,
  Film,
  Tv,
  Clapperboard,
  Music,
  Video,
  Info,
  Clock,
  X,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { PROJECT_TYPES, type ProjectType } from '@/types';

type Step = 'details' | 'upload' | 'processing' | 'ready';

const TYPE_ICONS: Record<ProjectType, typeof Film> = {
  'Feature Film': Film,
  'TV Series': Tv,
  'Commercial': Clapperboard,
  'Music Video': Music,
  'Short Film': Video,
};

interface CreateProjectProps {
  onComplete: (projectId: string) => void;
  onCancel: () => void;
}

export function CreateProject({ onComplete, onCancel }: CreateProjectProps) {
  const [step, setStep] = useState<Step>('details');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [dragOverScript, setDragOverScript] = useState(false);
  const [dragOverSchedule, setDragOverSchedule] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const scheduleInputRef = useRef<HTMLInputElement>(null);
  const addProject = useProjectStore((s) => s.addProject);

  const canProceedToUpload = title.trim() && projectType;

  const handleNext = () => {
    if (step === 'details' && canProceedToUpload) {
      setStep('upload');
    } else if (step === 'upload') {
      if (scriptFile) {
        setStep('processing');
        simulateProcessing();
      } else {
        createProject();
      }
    }
  };

  const handleBack = () => {
    if (step === 'upload') setStep('details');
  };

  const simulateProcessing = useCallback(() => {
    const stages = [
      { progress: 15, status: 'Reading script...', delay: 400 },
      { progress: 35, status: 'Detecting scenes...', delay: 800 },
      { progress: 55, status: 'Identifying characters...', delay: 600 },
      { progress: 75, status: 'Building breakdown...', delay: 500 },
      { progress: 90, status: 'Almost done...', delay: 400 },
      { progress: 100, status: 'Complete!', delay: 300 },
    ];

    let i = 0;
    const run = () => {
      if (i < stages.length) {
        const stage = stages[i];
        setProgress(stage.progress);
        setProgressStatus(stage.status);
        i++;
        setTimeout(run, stage.delay);
      } else {
        setTimeout(() => setStep('ready'), 500);
      }
    };
    run();
  }, []);

  const createProject = useCallback(() => {
    const id = `project-${Date.now()}`;
    addProject({
      id,
      title: title.trim(),
      genre: genre.trim(),
      type: projectType,
      status: 'setup',
      progress: 0,
      lastActive: new Date().toISOString(),
      scenes: 0,
      characters: 0,
      scriptFilename: scriptFile?.name,
      scheduleFilename: scheduleFile?.name,
      createdAt: new Date().toISOString(),
    });
    onComplete(id);
  }, [title, genre, projectType, scriptFile, scheduleFile, addProject, onComplete]);

  const handleDrop = (
    e: React.DragEvent,
    setFile: (f: File) => void,
    setDrag: (d: boolean) => void,
    accept: string[]
  ) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && accept.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setFile(file);
      if (setFile === setScriptFile && !title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      if (setFile === setScriptFile && !title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  // Step indicator
  const steps = [
    { key: 'details', label: 'Details' },
    { key: 'upload', label: 'Files' },
  ] as const;
  const currentStepIndex = step === 'details' ? 0 : step === 'upload' ? 1 : 1;

  return (
    <div
      className="min-h-[calc(100vh-4rem)] flex"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Left panel: decorative */}
      <div
        className="hidden lg:flex w-[400px] flex-col items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Subtle gold glow */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-20 blur-[100px]"
          style={{ backgroundColor: 'var(--gold-primary)' }}
        />

        <div className="relative z-10 text-center px-12">
          {/* Film strip icon */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{
              background: 'var(--gold-muted)',
              border: '1px solid var(--gold-border)',
            }}
          >
            <Clapperboard
              size={36}
              style={{ color: 'var(--gold-primary)' }}
            />
          </div>

          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
          >
            Start Something New
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Set up your production, upload your script, and let Prep Happy do the
            heavy lifting. Your breakdown, characters, and continuity tracking
            will be ready in moments.
          </p>

          {/* Feature list */}
          <div className="mt-10 space-y-4 text-left">
            {[
              { icon: FileText, text: 'Automatic scene detection' },
              { icon: Sparkles, text: 'Character extraction' },
              { icon: Calendar, text: 'Schedule integration' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--gold-muted)' }}
                >
                  <Icon size={16} style={{ color: 'var(--gold-primary)' }} />
                </div>
                <span
                  className="text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: form content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className="h-16 flex items-center justify-between px-8 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            onClick={step === 'details' ? onCancel : handleBack}
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'var(--text-primary)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'var(--text-secondary)')
            }
          >
            <ArrowLeft size={18} />
            {step === 'details' ? 'Back to Projects' : 'Back'}
          </button>

          {/* Step indicator (only for details/upload) */}
          {(step === 'details' || step === 'upload') && (
            <div className="flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                      style={{
                        backgroundColor:
                          i <= currentStepIndex
                            ? 'var(--gold-primary)'
                            : 'var(--bg-card)',
                        color:
                          i <= currentStepIndex
                            ? '#1a1510'
                            : 'var(--text-muted)',
                        border:
                          i <= currentStepIndex
                            ? 'none'
                            : '1px solid var(--border-default)',
                      }}
                    >
                      {i < currentStepIndex ? (
                        <Check size={12} />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className="text-xs font-medium hidden sm:inline"
                      style={{
                        color:
                          i <= currentStepIndex
                            ? 'var(--text-primary)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="w-8 h-px"
                      style={{
                        backgroundColor:
                          i < currentStepIndex
                            ? 'var(--gold-primary)'
                            : 'var(--border-default)',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="w-24" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'details' && (
            <DetailsStep
              title={title}
              genre={genre}
              projectType={projectType}
              onTitleChange={setTitle}
              onGenreChange={setGenre}
              onTypeChange={setProjectType}
              onNext={handleNext}
              canProceed={!!canProceedToUpload}
            />
          )}

          {step === 'upload' && (
            <UploadStep
              scriptFile={scriptFile}
              scheduleFile={scheduleFile}
              dragOverScript={dragOverScript}
              dragOverSchedule={dragOverSchedule}
              scriptInputRef={scriptInputRef}
              scheduleInputRef={scheduleInputRef}
              onDragOverScript={setDragOverScript}
              onDragOverSchedule={setDragOverSchedule}
              onDropScript={(e) =>
                handleDrop(e, setScriptFile, setDragOverScript, [
                  '.pdf',
                  '.fdx',
                  '.fountain',
                  '.txt',
                ])
              }
              onDropSchedule={(e) =>
                handleDrop(e, setScheduleFile, setDragOverSchedule, [
                  '.pdf',
                  '.xlsx',
                  '.csv',
                ])
              }
              onSelectScript={(e) => handleFileSelect(e, setScriptFile)}
              onSelectSchedule={(e) => handleFileSelect(e, setScheduleFile)}
              onClearScript={() => setScriptFile(null)}
              onClearSchedule={() => setScheduleFile(null)}
              onNext={handleNext}
              hasScript={!!scriptFile}
            />
          )}

          {step === 'processing' && (
            <ProcessingStep
              fileName={scriptFile?.name || ''}
              progress={progress}
              status={progressStatus}
            />
          )}

          {step === 'ready' && (
            <ReadyStep
              title={title}
              type={projectType}
              hasScript={!!scriptFile}
              hasSchedule={!!scheduleFile}
              onCreate={createProject}
            />
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={scriptInputRef}
        type="file"
        accept=".pdf,.fdx,.fountain,.txt"
        onChange={(e) => handleFileSelect(e, setScriptFile)}
        className="hidden"
      />
      <input
        ref={scheduleInputRef}
        type="file"
        accept=".pdf,.xlsx,.csv"
        onChange={(e) => handleFileSelect(e, setScheduleFile)}
        className="hidden"
      />
    </div>
  );
}

/* ━━━ Step 1: Project Details ━━━ */

interface DetailsStepProps {
  title: string;
  genre: string;
  projectType: string;
  onTitleChange: (v: string) => void;
  onGenreChange: (v: string) => void;
  onTypeChange: (v: ProjectType | '') => void;
  onNext: () => void;
  canProceed: boolean;
}

function DetailsStep({
  title,
  genre,
  projectType,
  onTitleChange,
  onGenreChange,
  onTypeChange,
  onNext,
  canProceed,
}: DetailsStepProps) {
  return (
    <div className="max-w-lg mx-auto px-8 py-12 animate-fade-in-up">
      <div className="mb-10">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
        >
          Create New Project
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Tell us about your production. You can always update these later.
        </p>
      </div>

      <div className="space-y-6">
        {/* Project Title */}
        <div className="animate-fade-in-up stagger-1">
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Project Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. The Deadline"
            className="input-field text-base"
            autoFocus
          />
        </div>

        {/* Genre */}
        <div className="animate-fade-in-up stagger-2">
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Genre
          </label>
          <input
            type="text"
            value={genre}
            onChange={(e) => onGenreChange(e.target.value)}
            placeholder="e.g. Thriller, Comedy, Drama"
            className="input-field"
          />
        </div>

        {/* Project Type (visual selector) */}
        <div className="animate-fade-in-up stagger-3">
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Production Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PROJECT_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type];
              const selected = projectType === type;
              return (
                <button
                  key={type}
                  onClick={() => onTypeChange(type)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                  style={{
                    backgroundColor: selected
                      ? 'var(--gold-muted)'
                      : 'var(--bg-card)',
                    border: `1px solid ${
                      selected
                        ? 'var(--gold-primary)'
                        : 'var(--border-subtle)'
                    }`,
                    boxShadow: selected ? 'var(--shadow-gold)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) {
                      e.currentTarget.style.borderColor =
                        'var(--border-default)';
                      e.currentTarget.style.backgroundColor =
                        'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) {
                      e.currentTarget.style.borderColor =
                        'var(--border-subtle)';
                      e.currentTarget.style.backgroundColor =
                        'var(--bg-card)';
                    }
                  }}
                >
                  <Icon
                    size={22}
                    style={{
                      color: selected
                        ? 'var(--gold-primary)'
                        : 'var(--text-muted)',
                    }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: selected
                        ? 'var(--gold-primary)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Continue button */}
      <div className="mt-10 animate-fade-in-up stagger-4">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="btn-gold w-full py-3.5 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight size={16} />
        </button>
        <p
          className="text-center text-xs mt-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Step 1 of 2
        </p>
      </div>
    </div>
  );
}

/* ━━━ Step 2: File Upload ━━━ */

interface UploadStepProps {
  scriptFile: File | null;
  scheduleFile: File | null;
  dragOverScript: boolean;
  dragOverSchedule: boolean;
  scriptInputRef: React.RefObject<HTMLInputElement | null>;
  scheduleInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOverScript: (v: boolean) => void;
  onDragOverSchedule: (v: boolean) => void;
  onDropScript: (e: React.DragEvent) => void;
  onDropSchedule: (e: React.DragEvent) => void;
  onSelectScript: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectSchedule: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearScript: () => void;
  onClearSchedule: () => void;
  onNext: () => void;
  hasScript: boolean;
}

function UploadStep({
  scriptFile,
  scheduleFile,
  dragOverScript,
  dragOverSchedule,
  scriptInputRef,
  scheduleInputRef,
  onDragOverScript,
  onDragOverSchedule,
  onDropScript,
  onDropSchedule,
  onSelectScript,
  onSelectSchedule,
  onClearScript,
  onClearSchedule,
  onNext,
  hasScript,
}: UploadStepProps) {
  return (
    <div className="max-w-lg mx-auto px-8 py-12 animate-fade-in-up">
      <div className="mb-10">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
        >
          Upload Files
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Upload your script to auto-detect scenes and characters. You can also
          add these manually later.
        </p>
      </div>

      <div className="space-y-6">
        {/* Script upload */}
        <div className="animate-fade-in-up stagger-1">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Script
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                backgroundColor: 'var(--gold-muted)',
                color: 'var(--gold-primary)',
              }}
            >
              Recommended
            </span>
          </div>

          {scriptFile ? (
            <div
              className="upload-zone has-file p-5 flex items-center gap-4"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                }}
              >
                <Check size={22} style={{ color: 'var(--status-success)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {scriptFile.name}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--status-success)' }}
                >
                  {(scriptFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearScript();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = 'var(--status-error)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = 'var(--text-muted)')
                }
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              className={`upload-zone p-8 text-center ${dragOverScript ? 'drag-over' : ''}`}
              onClick={() => scriptInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOverScript(true);
              }}
              onDragLeave={() => onDragOverScript(false)}
              onDrop={onDropScript}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--gold-muted)' }}
              >
                <Upload size={24} style={{ color: 'var(--gold-primary)' }} />
              </div>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                Drop your script here or click to browse
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                PDF, Final Draft (.fdx), Fountain, or plain text
              </p>
            </div>
          )}
        </div>

        {/* Schedule upload */}
        <div className="animate-fade-in-up stagger-2">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Production Schedule
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Optional
            </span>
          </div>

          {scheduleFile ? (
            <div
              className="upload-zone has-file p-5 flex items-center gap-4"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                }}
              >
                <Check size={22} style={{ color: 'var(--status-success)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {scheduleFile.name}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--status-success)' }}
                >
                  {(scheduleFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSchedule();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = 'var(--status-error)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = 'var(--text-muted)')
                }
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              className={`upload-zone p-6 text-center ${dragOverSchedule ? 'drag-over' : ''}`}
              onClick={() => scheduleInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOverSchedule(true);
              }}
              onDragLeave={() => onDragOverSchedule(false)}
              onDrop={onDropSchedule}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--bg-card)' }}
                >
                  <Calendar
                    size={18}
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>
                <div className="text-left">
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Drop schedule here or click to browse
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    PDF or spreadsheet (strips, one-liner)
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info cards */}
        <div className="space-y-3 animate-fade-in-up stagger-3">
          <div
            className="flex gap-3 p-4 rounded-xl"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
            }}
          >
            <Info
              size={18}
              className="flex-shrink-0 mt-0.5"
              style={{ color: 'var(--status-info)' }}
            />
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <p className="font-semibold mb-0.5">Faster with a schedule</p>
              <p style={{ color: 'var(--text-muted)' }}>
                The schedule contains the official cast list with character
                numbers. This allows instant, accurate character detection per
                scene.
              </p>
            </div>
          </div>

          <div
            className="flex gap-3 p-4 rounded-xl"
            style={{
              backgroundColor: 'var(--gold-muted)',
              border: '1px solid var(--gold-border)',
            }}
          >
            <Clock
              size={18}
              className="flex-shrink-0 mt-0.5"
              style={{ color: 'var(--gold-primary)' }}
            />
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <p className="font-semibold mb-0.5">Background processing</p>
              <p style={{ color: 'var(--text-muted)' }}>
                Character assignments will be confirmed within a few minutes.
                You can start working right away.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-10 space-y-3 animate-fade-in-up stagger-4">
        <button
          onClick={onNext}
          className="btn-gold w-full py-3.5 rounded-lg text-sm flex items-center justify-center gap-2"
        >
          {hasScript ? (
            <>
              Start Processing
              <Sparkles size={16} />
            </>
          ) : (
            <>
              Create Project
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {!hasScript && (
          <p
            className="text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            You can upload a script later from the project dashboard
          </p>
        )}
      </div>

      {/* Hidden inputs for file selection */}
      <input
        ref={scriptInputRef}
        type="file"
        accept=".pdf,.fdx,.fountain,.txt"
        onChange={onSelectScript}
        className="hidden"
      />
      <input
        ref={scheduleInputRef}
        type="file"
        accept=".pdf,.xlsx,.csv"
        onChange={onSelectSchedule}
        className="hidden"
      />
    </div>
  );
}

/* ━━━ Processing Step ━━━ */

interface ProcessingStepProps {
  fileName: string;
  progress: number;
  status: string;
}

function ProcessingStep({ fileName, progress, status }: ProcessingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 animate-fade-in">
      {/* Animated icon */}
      <div
        className="w-24 h-24 rounded-2xl flex items-center justify-center mb-8 relative"
        style={{
          backgroundColor: 'var(--gold-muted)',
          border: '1px solid var(--gold-border)',
        }}
      >
        <FileText
          size={40}
          style={{ color: 'var(--gold-primary)' }}
          className={progress < 100 ? 'animate-pulse' : ''}
        />
        {progress >= 100 && (
          <div
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center animate-scale-in"
            style={{
              backgroundColor: 'var(--status-success)',
            }}
          >
            <Check size={16} color="white" />
          </div>
        )}
      </div>

      <h2
        className="text-xl font-bold mb-1"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
      >
        Processing Script
      </h2>
      <p
        className="text-sm mb-8 truncate max-w-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        {fileName}
      </p>

      {/* Progress bar */}
      <div className="w-80 max-w-full">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background:
                'linear-gradient(90deg, #a07628 0%, #c19a4e 50%, #d4b06a 100%)',
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-3">
          <p
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {status}
          </p>
          <p
            className="text-xs font-mono"
            style={{ color: 'var(--text-muted)' }}
          >
            {progress}%
          </p>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Ready Step ━━━ */

interface ReadyStepProps {
  title: string;
  type: string;
  hasScript: boolean;
  hasSchedule: boolean;
  onCreate: () => void;
}

function ReadyStep({
  title,
  type,
  hasScript,
  hasSchedule,
  onCreate,
}: ReadyStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 animate-fade-in-up">
      {/* Success icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{
          background:
            'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
          border: '1px solid rgba(16,185,129,0.3)',
        }}
      >
        <Check size={36} style={{ color: 'var(--status-success)' }} />
      </div>

      <h2
        className="text-2xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
      >
        Ready to Go
      </h2>
      <p
        className="text-sm mb-8 text-center max-w-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        Your project has been set up successfully. Everything is ready for you to
        start working.
      </p>

      {/* Summary */}
      <div
        className="w-full max-w-sm rounded-xl p-5 mb-8 space-y-3"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Project
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </span>
        </div>
        <div
          className="h-px"
          style={{ backgroundColor: 'var(--border-subtle)' }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Type
          </span>
          <span
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {type}
          </span>
        </div>
        <div
          className="h-px"
          style={{ backgroundColor: 'var(--border-subtle)' }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Script
          </span>
          <span
            className="text-sm"
            style={{
              color: hasScript
                ? 'var(--status-success)'
                : 'var(--text-muted)',
            }}
          >
            {hasScript ? 'Uploaded' : 'Not uploaded'}
          </span>
        </div>
        <div
          className="h-px"
          style={{ backgroundColor: 'var(--border-subtle)' }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Schedule
          </span>
          <span
            className="text-sm"
            style={{
              color: hasSchedule
                ? 'var(--status-success)'
                : 'var(--text-muted)',
            }}
          >
            {hasSchedule ? 'Uploaded' : 'Not uploaded'}
          </span>
        </div>
      </div>

      <button
        onClick={onCreate}
        className="btn-gold px-12 py-3.5 rounded-lg text-sm flex items-center justify-center gap-2"
      >
        Open Project
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
