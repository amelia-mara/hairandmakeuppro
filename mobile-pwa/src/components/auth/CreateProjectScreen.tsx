import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';
import type { ProductionType } from '@/types';
import { PRODUCTION_TYPES } from '@/types';

export function CreateProjectScreen() {
  const { setScreen, createProject, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [productionType, setProductionType] = useState<ProductionType>('film');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!name.trim()) return;

    const result = await createProject(name.trim(), productionType);

    if (result.success && result.code) {
      setCreatedCode(result.code);
    }
  };

  const handleCopyCode = async () => {
    if (!createdCode) return;

    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = createdCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!createdCode || !navigator.share) return;

    try {
      await navigator.share({
        title: `Join ${name} on Checks Happy`,
        text: `Join my project "${name}" on Checks Happy using code: ${createdCode}`,
      });
    } catch {
      // User cancelled or share not supported
    }
  };

  const isValid = name.trim();

  // Success state - show generated code
  if (createdCode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header with back button */}
        <header className="flex items-center px-4 py-3 safe-top">
          <button
            onClick={() => setScreen('hub')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2"
            aria-label="Go back"
          >
            <svg
              className="w-6 h-6 text-text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-text-primary pr-10">
            Project Created
          </h1>
        </header>

        {/* Main content */}
        <div className="flex-1 px-6 pt-8 flex flex-col items-center">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-green-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-text-primary mb-2 text-center">
            {name}
          </h2>
          <p className="text-text-secondary text-center mb-8">
            Share this code with your team
          </p>

          {/* Code display */}
          <div className="w-full max-w-xs bg-card border border-border rounded-xl p-6 mb-6">
            <p className="text-3xl font-mono font-bold text-center tracking-widest text-text-primary mb-4">
              {createdCode}
            </p>
            <div className="flex gap-2">
              <Button
                fullWidth
                variant="outline"
                onClick={handleCopyCode}
                className="flex-1"
              >
                {copied ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Copied!
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </span>
                )}
              </Button>
              {'share' in navigator && (
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="px-4"
                  aria-label="Share"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="M8.59 13.51l6.83 3.98" />
                    <path d="M15.41 6.51l-6.82 3.98" />
                  </svg>
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-text-muted text-center max-w-xs">
            Team members can use this code to join your project from the app.
          </p>
        </div>

        {/* Bottom action */}
        <div className="px-6 py-4 pb-safe-bottom">
          <Button
            fullWidth
            size="lg"
            onClick={() => setScreen('hub')}
          >
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  // Create form
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with back button */}
      <header className="flex items-center px-4 py-3 safe-top">
        <button
          onClick={() => setScreen('hub')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2"
          aria-label="Go back"
        >
          <svg
            className="w-6 h-6 text-text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 px-6 pt-4">
        {/* Title */}
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Create Project
        </h1>
        <p className="text-text-secondary mb-8">
          Set up a new production for your team
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="text"
            label="Production Name"
            placeholder="e.g., The Crown S6"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />

          {/* Production type select */}
          <div>
            <label className="field-label block mb-2">Production Type</label>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setProductionType(type.value)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    productionType === type.value
                      ? 'border-gold bg-gold-50 text-gold'
                      : 'border-border bg-card text-text-secondary hover:border-gold-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            fullWidth
            size="lg"
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </span>
            ) : (
              'Create Project'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
