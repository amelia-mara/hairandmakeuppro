import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';
import { formatProjectCode, isValidProjectCode } from '@/types';

export function JoinProjectScreen() {
  const { goBack, joinProject, isLoading, error, clearError } = useAuthStore();

  const [code, setCode] = useState('');

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatProjectCode(e.target.value);
    setCode(formatted);
    if (error) clearError();
  };

  const handleSubmit = async () => {
    clearError();

    if (!isValidProjectCode(code)) return;

    await joinProject(code);
    // On success, joinProject loads the project into the store and
    // App.tsx will automatically render the project dashboard
  };

  const isValid = isValidProjectCode(code);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with back button */}
      <header className="flex items-center px-4 py-3 safe-top">
        <button
          onClick={goBack}
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
          Join a Team
        </h1>
        <p className="text-text-secondary mb-8">
          Enter the project code shared by your supervisor
        </p>

        {/* Code input visualization */}
        <div className="mb-8">
          <label className="field-label block mb-2">Project Code</label>
          <div className="relative">
            <Input
              type="text"
              placeholder="ABC-1234"
              value={code}
              onChange={handleCodeChange}
              className="text-center text-2xl tracking-[0.2em] font-mono uppercase"
              maxLength={8}
              disabled={isLoading}
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
          <p className="mt-2 text-xs text-text-muted text-center">
            Format: ABC-1234
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <Button
          fullWidth
          size="lg"
          disabled={!isValid || isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Joining...
            </span>
          ) : (
            'Join'
          )}
        </Button>

        {/* Info card */}
        <div className="mt-8 p-4 bg-gold-50 border border-gold-200 rounded-xl">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-gold"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gold-800">
                The project will be added to your hub.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
