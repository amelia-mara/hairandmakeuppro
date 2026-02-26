import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';
import { formatProjectCode, isValidProjectCode } from '@/types';
import * as supabaseProjects from '@/services/supabaseProjects';

// Position options shown when joining a project.
// Maps user-friendly labels to DB project_members.role values.
const JOIN_POSITIONS = [
  { value: 'designer', label: 'Designer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'key', label: 'Artist' },
  { value: 'floor', label: 'Standby' },
  { value: 'trainee', label: 'Trainee' },
  { value: 'daily', label: 'Daily' },
] as const;

type JoinRole = (typeof JOIN_POSITIONS)[number]['value'];

export function JoinProjectScreen() {
  const { user, goBack, joinProject, isLoading, error, clearError } = useAuthStore();

  const [code, setCode] = useState('');

  // Role selection popup state
  const [showRolePopup, setShowRolePopup] = useState(false);
  const [validatedProjectName, setValidatedProjectName] = useState('');
  const [selectedRole, setSelectedRole] = useState<JoinRole | null>(null);
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [isValidating, setIsValidating] = useState(false);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatProjectCode(e.target.value);
    setCode(formatted);
    if (error) clearError();
  };

  // Step 1: Validate the code and show the role selection popup
  const handleSubmit = async () => {
    clearError();
    if (!isValidProjectCode(code)) return;

    setIsValidating(true);
    try {
      const { project, error: lookupError } = await supabaseProjects.getProjectByInviteCode(code);
      if (lookupError || !project) {
        useAuthStore.setState({ error: lookupError?.message || 'Invalid project code. Please check and try again.' });
        setIsValidating(false);
        return;
      }

      setValidatedProjectName(project.name);
      setDisplayName(user?.name || '');
      setSelectedRole(null);
      setShowRolePopup(true);
    } catch {
      useAuthStore.setState({ error: 'Failed to validate project code. Please try again.' });
    }
    setIsValidating(false);
  };

  // Step 2: Join with the selected role
  const handleConfirmJoin = async () => {
    if (!selectedRole) return;

    await joinProject(code, selectedRole);
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
              disabled={isLoading || isValidating}
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
          disabled={!isValid || isLoading || isValidating}
          onClick={handleSubmit}
        >
          {isValidating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking...
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

      {/* Role selection popup */}
      {showRolePopup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-[430px] bg-card rounded-t-2xl shadow-xl animate-slideUp safe-bottom">
            <div className="p-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Join {validatedProjectName}</h2>
                  <p className="text-sm text-text-muted mt-0.5">Confirm your details</p>
                </div>
                <button
                  onClick={() => setShowRolePopup(false)}
                  className="p-2 -m-2 text-text-muted hover:text-text-primary"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {/* Name field */}
              <div className="mb-5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">
                  Your Name
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  disabled={isLoading}
                />
              </div>

              {/* Position selection */}
              <div className="mb-5">
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">
                  Your Position
                </label>
                <div className="space-y-2">
                  {JOIN_POSITIONS.map((pos) => (
                    <button
                      key={pos.value}
                      onClick={() => setSelectedRole(pos.value)}
                      className={`w-full px-4 py-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                        selectedRole === pos.value
                          ? 'bg-gold-50 border border-gold'
                          : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <span className={`text-sm font-medium ${
                        selectedRole === pos.value ? 'text-gold' : 'text-text-primary'
                      }`}>
                        {pos.label}
                      </span>
                      {selectedRole === pos.value && (
                        <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirm button */}
              <Button
                fullWidth
                size="lg"
                disabled={!selectedRole || !displayName.trim() || isLoading}
                onClick={handleConfirmJoin}
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
                  'Confirm & Join'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
