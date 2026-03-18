import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col" style={{
      background: 'linear-gradient(180deg, #fffdfb 0%, #fefcfb 30%, #faf6f0 70%, #f5efe5 100%)'
    }}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Wordmark - stacked with colored stripes, offset text */}
        <div className="flex flex-col items-center mb-2">
          <div style={{ position: 'relative', width: '280px' }}>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 800,
              fontSize: '48px',
              color: '#4A3020',
              lineHeight: 1,
              margin: '0 0 -2px 0',
              textAlign: 'center',
              paddingLeft: '40px',
            }}>
              Checks
            </h1>

            {/* Colored stripes - orange, amber, blue (top to bottom) */}
            <div style={{ width: '100vw', position: 'relative', left: '50%', transform: 'translateX(-50%)', margin: '2px 0 0 0' }}>
              <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #E8621A, transparent)', marginBottom: '3px' }} />
              <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #D4A843, transparent)', marginBottom: '3px' }} />
              <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, #5B9BD5, transparent)' }} />
            </div>

            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 800,
              fontStyle: 'italic',
              fontSize: '48px',
              color: '#E8621A',
              lineHeight: 1,
              margin: '-6px 0 0 0',
              textAlign: 'center',
              transform: 'rotate(-2deg)',
            }}>
              Happy
            </h1>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-lg mb-10" style={{ color: '#6a6a6a' }}>
          Your personal onset assistant
        </p>

        {/* Feature icons - BLACK, SOLID, BOLD */}
        <div className="flex items-center justify-center w-full max-w-md mb-12">
          {/* Capture - Camera icon - SOLID */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Camera body - filled for solid look */}
              <path
                d="M4 18C4 15.79 5.79 14 8 14H14L18 8H38L42 14H48C50.21 14 52 15.79 52 18V44C52 46.21 50.21 48 48 48H8C5.79 48 4 46.21 4 44V18Z"
                fill="#1a1a1a"
              />
              {/* Camera lens - white circle */}
              <circle cx="28" cy="30" r="10" fill="#fefcfb" />
              {/* Camera lens inner - black dot */}
              <circle cx="28" cy="30" r="5" fill="#1a1a1a" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Capture</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Track - Sync arrows icon - BOLD */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Circular arrow - top arc */}
              <path
                d="M28 8C16.954 8 8 16.954 8 28c0 4.5 1.5 8.6 4 12"
                stroke="#1a1a1a"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              {/* Circular arrow - bottom arc */}
              <path
                d="M28 48c11.046 0 20-8.954 20-20 0-4.5-1.5-8.6-4-12"
                stroke="#1a1a1a"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head - bottom left - FILLED */}
              <polygon points="4,36 14,44 16,32" fill="#1a1a1a" />
              {/* Arrow head - top right - FILLED */}
              <polygon points="52,20 42,12 40,24" fill="#1a1a1a" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Track</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Collaborate - People icon - Already solid */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Center person (larger) */}
              <circle cx="28" cy="14" r="8" fill="#1a1a1a" />
              <path d="M14 48v-10c0-7.732 6.268-14 14-14s14 6.268 14 14v10" fill="#1a1a1a" />
              {/* Left person */}
              <circle cx="10" cy="20" r="6" fill="#1a1a1a" />
              <path d="M0 48v-8c0-5.523 4.477-10 10-10 2.5 0 4.8.9 6.5 2.4" fill="#1a1a1a" />
              {/* Right person */}
              <circle cx="46" cy="20" r="6" fill="#1a1a1a" />
              <path d="M56 48v-8c0-5.523-4.477-10-10-10-2.5 0-4.8.9-6.5 2.4" fill="#1a1a1a" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Collaborate</span>
          </div>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-8 pb-10 space-y-4">
        {/* Sign In - Orange gradient background */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-full font-semibold text-lg transition-all duration-200
            text-white active:scale-[0.98] shadow-md"
          style={{ background: 'linear-gradient(180deg, #E8621A 0%, #D4570F 100%)' }}
        >
          Sign In
        </button>

        {/* Create Account - Dark border outlined */}
        <button
          onClick={() => setScreen('beta-code')}
          className="w-full h-14 rounded-full font-semibold text-lg transition-all duration-200
            border-2 border-[#3a2a1a] text-[#3a2a1a] bg-transparent active:scale-[0.98]"
        >
          Create Account
        </button>

        {/* Join a Team */}
        <div className="pt-4 flex items-center justify-center gap-4">
          <div className="flex-1 h-px bg-[#c5c0b5]" />
          <button
            className="text-sm text-[#7a7a7a] hover:text-[#4a4a4a] transition-colors whitespace-nowrap"
            onClick={() => setScreen('beta-code')}
          >
            Join a Team
          </button>
          <div className="flex-1 h-px bg-[#c5c0b5]" />
        </div>
      </div>
    </div>
  );
}
