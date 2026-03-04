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

  const steps = [
    { key: 'details', label: 'Details' },
    { key: 'upload', label: 'Files' },
  ] as const;
  const currentStepIndex = step === 'details' ? 0 : 1;

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', background: 'var(--bg-primary)' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex"
        style={{
          width: '400px',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(20, 18, 16, 0.6)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--glass-border)',
        }}
      >
        {/* Gold glow */}
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '256px',
            height: '256px',
            borderRadius: '50%',
            opacity: 0.15,
            filter: 'blur(100px)',
            backgroundColor: 'var(--accent-gold)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 48px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
              background: 'var(--accent-gold-soft)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <Clapperboard size={36} style={{ color: 'var(--accent-gold)' }} />
          </div>

          <h2 style={{ fontSize: '1.5em', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Start Something New
          </h2>
          <p style={{ fontSize: '0.875em', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Set up your production, upload your script, and let Prep Happy do the
            heavy lifting. Your breakdown, characters, and continuity tracking
            will be ready in moments.
          </p>

          <div style={{ marginTop: '40px', textAlign: 'left' }}>
            {[
              { icon: FileText, text: 'Automatic scene detection' },
              { icon: Sparkles, text: 'Character extraction' },
              { icon: Calendar, text: 'Schedule integration' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: 'var(--accent-gold-soft)',
                  }}
                >
                  <Icon size={16} style={{ color: 'var(--accent-gold)' }} />
                </div>
                <span style={{ fontSize: '0.875em', color: 'var(--text-secondary)' }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Sub-header */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={step === 'details' ? onCancel : handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.875em',
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.3s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <ArrowLeft size={18} />
            {step === 'details' ? 'Back to Projects' : 'Back'}
          </button>

          {(step === 'details' || step === 'upload') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {steps.map((s, i) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75em',
                        fontWeight: 600,
                        transition: 'all 0.3s',
                        backgroundColor: i <= currentStepIndex ? 'var(--accent-gold)' : 'transparent',
                        color: i <= currentStepIndex ? 'var(--bg-primary)' : 'var(--text-muted)',
                        border: i <= currentStepIndex ? 'none' : '1px solid var(--border-subtle)',
                      }}
                    >
                      {i < currentStepIndex ? <Check size={12} /> : i + 1}
                    </div>
                    <span
                      style={{
                        fontSize: '0.75em',
                        fontWeight: 500,
                        color: i <= currentStepIndex ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      style={{
                        width: '32px',
                        height: '1px',
                        backgroundColor: i < currentStepIndex ? 'var(--accent-gold)' : 'var(--border-subtle)',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ width: '96px' }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
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
                handleDrop(e, setScriptFile, setDragOverScript, ['.pdf', '.fdx', '.fountain', '.txt'])
              }
              onDropSchedule={(e) =>
                handleDrop(e, setScheduleFile, setDragOverSchedule, ['.pdf', '.xlsx', '.csv'])
              }
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

/* ━━━ Step 1: Details ━━━ */

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
    <div className="animate-fade-in-up" style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 32px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '1.5em', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Create New Project
        </h1>
        <p style={{ fontSize: '0.875em', color: 'var(--text-secondary)' }}>
          Tell us about your production. You can always update these later.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Title */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Project Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. The Deadline"
            className="input-field"
            style={{ padding: '12px 16px', fontSize: '0.9375em' }}
            autoFocus
          />
        </div>

        {/* Genre */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Genre
          </label>
          <input
            type="text"
            value={genre}
            onChange={(e) => onGenreChange(e.target.value)}
            placeholder="e.g. Thriller, Comedy, Drama"
            className="input-field"
            style={{ padding: '12px 16px', fontSize: '0.9375em' }}
          />
          <p style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginTop: '4px' }}>Optional</p>
        </div>

        {/* Type selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Production Type
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {PROJECT_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type];
              const selected = projectType === type;
              return (
                <button
                  key={type}
                  onClick={() => onTypeChange(type)}
                  className="glass"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '16px 8px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    borderColor: selected ? 'var(--border-glow)' : undefined,
                    background: selected ? 'var(--accent-gold-soft)' : undefined,
                    boxShadow: selected ? 'var(--glow-medium)' : undefined,
                  }}
                >
                  <Icon size={22} style={{ color: selected ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.75em', fontWeight: 500, color: selected ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                    {type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Continue */}
      <div style={{ marginTop: '40px' }}>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="btn-gold"
          style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ━━━ Step 2: Upload ━━━ */

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
  onClearScript,
  onClearSchedule,
  onNext,
  hasScript,
}: UploadStepProps) {
  return (
    <div className="animate-fade-in-up" style={{ maxWidth: '480px', margin: '0 auto', padding: '48px 32px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '1.5em', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Upload Files
        </h1>
        <p style={{ fontSize: '0.875em', color: 'var(--text-secondary)' }}>
          Upload your script to auto-detect scenes and characters.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Script upload */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <label style={{ fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)' }}>Script</label>
            <span style={{
              fontSize: '0.625em',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 600,
              background: 'var(--accent-gold-soft)',
              color: 'var(--accent-gold)',
            }}>
              Recommended
            </span>
          </div>

          {scriptFile ? (
            <div className="upload-zone has-file" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(34, 197, 94, 0.1)' }}>
                <Check size={22} style={{ color: 'var(--status-success)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scriptFile.name}
                </p>
                <p style={{ fontSize: '0.75em', color: 'var(--status-success)' }}>
                  {(scriptFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClearScript(); }}
                style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-error)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              className={`upload-zone ${dragOverScript ? 'drag-over' : ''}`}
              style={{ padding: '32px', textAlign: 'center' }}
              onClick={() => scriptInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); onDragOverScript(true); }}
              onDragLeave={() => onDragOverScript(false)}
              onDrop={onDropScript}
            >
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'var(--accent-gold-soft)' }}>
                <Upload size={24} style={{ color: 'var(--accent-gold)' }} />
              </div>
              <p style={{ fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Drop your script here or click to browse
              </p>
              <p style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
                PDF, Final Draft (.fdx), Fountain, or plain text
              </p>
            </div>
          )}
        </div>

        {/* Schedule upload */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <label style={{ fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)' }}>Production Schedule</label>
            <span style={{
              fontSize: '0.625em',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 500,
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}>
              Optional
            </span>
          </div>

          {scheduleFile ? (
            <div className="upload-zone has-file" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(34, 197, 94, 0.1)' }}>
                <Check size={22} style={{ color: 'var(--status-success)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875em', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scheduleFile.name}
                </p>
                <p style={{ fontSize: '0.75em', color: 'var(--status-success)' }}>
                  {(scheduleFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClearSchedule(); }}
                style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-error)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              className={`upload-zone ${dragOverSchedule ? 'drag-over' : ''}`}
              style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}
              onClick={() => scheduleInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); onDragOverSchedule(true); }}
              onDragLeave={() => onDragOverSchedule(false)}
              onDrop={onDropSchedule}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--bg-secondary)' }}>
                <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <p style={{ fontSize: '0.875em', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Drop schedule here or click to browse
                </p>
                <p style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
                  PDF or spreadsheet (strips, one-liner)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass" style={{ display: 'flex', gap: '12px', padding: '16px', borderRadius: '12px', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
            <Info size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--status-info)' }} />
            <div style={{ fontSize: '0.75em' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Faster with a schedule</p>
              <p style={{ color: 'var(--text-muted)' }}>
                The schedule contains the official cast list with character numbers for instant, accurate detection.
              </p>
            </div>
          </div>

          <div className="glass" style={{ display: 'flex', gap: '12px', padding: '16px', borderRadius: '12px', background: 'var(--accent-gold-soft)', borderColor: 'var(--border-medium)' }}>
            <Clock size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-gold)' }} />
            <div style={{ fontSize: '0.75em' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Background processing</p>
              <p style={{ color: 'var(--text-muted)' }}>
                Character assignments will be confirmed within a few minutes. You can start working right away.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: '40px' }}>
        <button
          onClick={onNext}
          className="btn-gold"
          style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {hasScript ? (
            <>Start Processing <Sparkles size={16} /></>
          ) : (
            <>Create Project <ArrowRight size={16} /></>
          )}
        </button>

        {!hasScript && (
          <p style={{ textAlign: 'center', fontSize: '0.75em', color: 'var(--text-muted)', marginTop: '12px' }}>
            You can upload a script later from the project dashboard
          </p>
        )}
      </div>
    </div>
  );
}

/* ━━━ Processing ━━━ */

function ProcessingStep({ fileName, progress, status }: { fileName: string; progress: number; status: string }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '32px' }}>
      <div
        style={{
          width: '96px',
          height: '96px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          position: 'relative',
          background: 'var(--accent-gold-soft)',
          border: '1px solid var(--border-medium)',
        }}
      >
        <FileText
          size={40}
          style={{ color: 'var(--accent-gold)' }}
          className={progress < 100 ? 'animate-pulse' : ''}
        />
        {progress >= 100 && (
          <div
            className="animate-scale-in"
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--status-success)',
            }}
          >
            <Check size={16} color="white" />
          </div>
        )}
      </div>

      <h2 style={{ fontSize: '1.25em', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '4px' }}>
        Processing Script
      </h2>
      <p style={{ fontSize: '0.875em', color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fileName}
      </p>

      <div style={{ width: '320px', maxWidth: '100%' }}>
        <div style={{ height: '8px', borderRadius: '999px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
          <div
            style={{
              height: '100%',
              borderRadius: '999px',
              transition: 'width 0.5s ease-out',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--accent-gold), rgba(201, 169, 97, 0.6))',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <p style={{ fontSize: '0.75em', fontWeight: 500, color: 'var(--text-secondary)' }}>{status}</p>
          <p style={{ fontSize: '0.75em', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{progress}%</p>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Ready ━━━ */

function ReadyStep({ title, type, hasScript, hasSchedule, onCreate }: { title: string; type: string; hasScript: boolean; hasSchedule: boolean; onCreate: () => void }) {
  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '32px' }}>
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        }}
      >
        <Check size={36} style={{ color: 'var(--status-success)' }} />
      </div>

      <h2 style={{ fontSize: '1.5em', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '8px' }}>
        Ready to Go
      </h2>
      <p style={{ fontSize: '0.875em', color: 'var(--text-secondary)', marginBottom: '32px', textAlign: 'center', maxWidth: '360px' }}>
        Your project has been set up successfully. Everything is ready for you to start working.
      </p>

      {/* Summary card */}
      <div
        className="glass"
        style={{ width: '100%', maxWidth: '360px', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}
      >
        {[
          { label: 'Project', value: title, color: 'var(--text-primary)', weight: 600 },
          { label: 'Type', value: type, color: 'var(--text-secondary)', weight: 400 },
          { label: 'Script', value: hasScript ? 'Uploaded' : 'Not uploaded', color: hasScript ? 'var(--status-success)' : 'var(--text-muted)', weight: 400 },
          { label: 'Schedule', value: hasSchedule ? 'Uploaded' : 'Not uploaded', color: hasSchedule ? 'var(--status-success)' : 'var(--text-muted)', weight: 400 },
        ].map((item, i, arr) => (
          <div key={item.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>{item.label}</span>
              <span style={{ fontSize: '0.875em', fontWeight: item.weight, color: item.color }}>{item.value}</span>
            </div>
            {i < arr.length - 1 && <div style={{ height: '1px', background: 'var(--glass-border)' }} />}
          </div>
        ))}
      </div>

      <button
        onClick={onCreate}
        className="btn-gold"
        style={{ padding: '14px 48px', borderRadius: '8px', fontSize: '0.875em', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        Open Project
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
