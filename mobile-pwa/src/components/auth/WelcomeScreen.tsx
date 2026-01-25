import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-gold/5 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute -bottom-48 -left-32 w-96 h-96 bg-gold/5 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-6 relative z-10">
        {/* Logo and branding */}
        <div className="flex flex-col items-center mb-14">
          {/* Premium logo mark */}
          <div className="relative mb-8 animate-scaleIn" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
            <div className="absolute inset-0 gold-gradient rounded-[28px] blur-xl opacity-40 scale-110 animate-pulse-subtle" />
            <div className="relative w-28 h-28 gold-gradient rounded-[28px] flex items-center justify-center shadow-2xl ring-1 ring-white/20">
              <svg
                className="w-16 h-16 text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Refined brush icon */}
                <path d="M18.5 2.5L21.5 5.5" />
                <path d="M15 6L18.5 2.5" />
                <ellipse cx="9.5" cy="15" rx="5.5" ry="7" />
                <path d="M15 6L10 12" />
                <path d="M6.5 11.5C6.5 11.5 7.5 13.5 9.5 15" />
                <path d="M12.5 11.5C12.5 11.5 11.5 13.5 9.5 15" />
              </svg>
            </div>
          </div>

          {/* App name with refined typography */}
          <h1
            className="text-[2.5rem] font-bold text-text-primary tracking-tight mb-2 animate-fadeInUp"
            style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}
          >
            Checks Happy
          </h1>

          {/* Elegant tagline */}
          <p
            className="text-lg text-text-secondary font-light tracking-wide animate-fadeInUp"
            style={{ animationDelay: '0.25s', opacity: 0, animationFillMode: 'forwards' }}
          >
            Your onset assistant
          </p>
        </div>

        {/* Feature cards - Premium glass style */}
        <div className="w-full max-w-sm space-y-3 mb-8">
          <FeatureCard
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            }
            title="Continuity Tracking"
            description="Scene-by-scene consistency"
            delay={1}
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            }
            title="Reference Photos"
            description="Capture every detail"
            delay={2}
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            title="Team Collaboration"
            description="Work together seamlessly"
            delay={3}
          />
        </div>
      </div>

      {/* Bottom action buttons - Premium styling */}
      <div className="px-8 pb-safe-bottom space-y-3 relative z-10 animate-fadeInUp" style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}>
        {/* Subtle divider */}
        <div className="flex items-center justify-center mb-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        </div>

        <Button
          fullWidth
          size="lg"
          onClick={() => setScreen('signin')}
          className="!h-14 !text-base !font-semibold shadow-lg shadow-gold/20 hover:shadow-xl hover:shadow-gold/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Sign In
        </Button>

        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={() => setScreen('signup')}
          className="!h-14 !text-base !font-semibold !border-2 hover:bg-gold/5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Create Account
        </Button>

        <button
          className="w-full py-4 text-gold font-medium hover:text-gold-dark active:scale-[0.98] transition-all duration-200"
          onClick={() => setScreen('join')}
        >
          Join a Team
        </button>
      </div>
    </div>
  );
}

// Premium feature card component
function FeatureCard({
  icon,
  title,
  description,
  delay = 0
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-gold/20 transition-all duration-300 animate-fadeInUp"
      style={{ animationDelay: `${delay * 0.1}s`, opacity: 0, animationFillMode: 'forwards' }}
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold/10 to-gold/5 flex items-center justify-center text-gold flex-shrink-0 ring-1 ring-gold/10">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-text-primary text-[15px] leading-tight">
          {title}
        </h3>
        <p className="text-sm text-text-muted mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}
