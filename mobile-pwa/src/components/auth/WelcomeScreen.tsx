import { useAuthStore } from '@/stores/authStore';
import logoTick from '/logo-tick.png';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col" style={{
      background: 'linear-gradient(180deg, #fffdfb 0%, #fefcfb 30%, #faf6f0 70%, #f5efe5 100%)'
    }}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo Icon - Using uploaded image with edge fade */}
        <img
          src={logoTick}
          alt="Checks Happy Logo"
          className="w-32 h-32 mb-3 object-contain"
          style={{
            maskImage: 'radial-gradient(ellipse 70% 70% at center, black 50%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at center, black 50%, transparent 100%)',
          }}
        />

        {/* CHECKS HAPPY text */}
        <h1 className="text-[34px] font-serif font-medium tracking-wide text-[#1a1a1a]">
          CHECKS HAPPY
        </h1>

        {/* Gold underline - tapered ends, thicker in middle */}
        <svg width="280" height="10" viewBox="0 0 280 10" className="mt-3 mb-8">
          <defs>
            <linearGradient id="underlineGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A962" stopOpacity="0.3" />
              <stop offset="10%" stopColor="#C9A962" />
              <stop offset="50%" stopColor="#D4B86A" />
              <stop offset="90%" stopColor="#C9A962" />
              <stop offset="100%" stopColor="#C9A962" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Tapered shape - pointed at ends, moderate thickness in middle */}
          <path
            d="M 0 5
               Q 40 5, 70 4.25
               Q 100 3.5, 140 3
               Q 180 3.5, 210 4.25
               Q 240 5, 280 5
               Q 240 5, 210 5.75
               Q 180 6.5, 140 7
               Q 100 6.5, 70 5.75
               Q 40 5, 0 5
               Z"
            fill="url(#underlineGold)"
          />
        </svg>

        {/* Tagline */}
        <p className="text-lg text-[#4a4a4a] mb-10">
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
        {/* Sign In - Shiny gold gradient background */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded font-semibold text-lg transition-all duration-200
            bg-gradient-to-b from-[#E2C87D] via-[#C9A962] to-[#A8893D] text-white active:scale-[0.98] shadow-md"
        >
          Sign In
        </button>

        {/* Create Account - Cream with black border */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded font-semibold text-lg transition-all duration-200
            border border-[#1a1a1a] text-[#1a1a1a] bg-[#fefcfb] active:scale-[0.98]"
        >
          Create Account
        </button>

        {/* Forgot Password with lines */}
        <div className="pt-8 flex items-center justify-center gap-4">
          <div className="flex-1 h-px bg-[#c5c0b5]" />
          <button
            className="text-sm text-[#7a7a7a] hover:text-[#4a4a4a] transition-colors whitespace-nowrap"
            onClick={() => setScreen('signin')}
          >
            Forgot Password?
          </button>
          <div className="flex-1 h-px bg-[#c5c0b5]" />
        </div>
      </div>
    </div>
  );
}
