import { useAuthStore } from '@/stores/authStore';

export function VerifyEmailScreen() {
  const { setScreen, user } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center px-4 py-3 safe-top">
        <button
          onClick={() => setScreen('welcome')}
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Email icon */}
        <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2 text-center">
          Check your email
        </h1>

        <p className="text-text-secondary text-center mb-2 max-w-xs">
          We've sent a verification link to
        </p>

        {user?.email && (
          <p className="text-text-primary font-medium text-center mb-6">
            {user.email}
          </p>
        )}

        <p className="text-text-muted text-sm text-center max-w-xs mb-8">
          Tap the link in the email to verify your account, then come back here and sign in.
        </p>

        {/* Sign in button */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full max-w-xs py-3.5 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform"
        >
          Go to Sign In
        </button>

        {/* Resend hint */}
        <p className="text-text-muted text-xs text-center mt-4 max-w-xs">
          Didn't get the email? Check your spam folder or try signing up again.
        </p>
      </div>
    </div>
  );
}
