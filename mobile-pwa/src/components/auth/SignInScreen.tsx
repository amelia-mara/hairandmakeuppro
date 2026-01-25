import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';

export function SignInScreen() {
  const { setScreen, goBack, signIn, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email.trim()) return;
    if (!password) return;

    await signIn(email.trim(), password);
  };

  const isValid = email.trim() && password;

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
          Welcome back
        </h1>
        <p className="text-text-secondary mb-8">
          Sign in to access your projects
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            disabled={isLoading}
          />

          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-text-muted hover:text-text-secondary"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Forgot password link */}
          <div className="text-right">
            <button
              type="button"
              className="text-sm text-gold hover:underline"
              onClick={() => {/* TODO: Implement forgot password */}}
            >
              Forgot password?
            </button>
          </div>

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
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </div>

      {/* Bottom link */}
      <div className="px-6 py-6 pb-safe-bottom text-center">
        <p className="text-text-secondary">
          Don't have an account?{' '}
          <button
            onClick={() => setScreen('signup')}
            className="text-gold font-medium hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
