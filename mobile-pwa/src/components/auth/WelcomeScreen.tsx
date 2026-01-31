import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo Icon - Gold checkmark with smaller ring that has gold/black gradient */}
        <svg
          width="110"
          height="110"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-5"
        >
          <defs>
            {/* Gold gradient for checkmark */}
            <linearGradient id="checkGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4B86A" />
              <stop offset="40%" stopColor="#C9A962" />
              <stop offset="100%" stopColor="#A8893D" />
            </linearGradient>
            {/* Ring gradient - gold/black shine effect */}
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a1a1a" />
              <stop offset="35%" stopColor="#3a3a3a" />
              <stop offset="45%" stopColor="#8B7332" />
              <stop offset="55%" stopColor="#C9A962" />
              <stop offset="65%" stopColor="#8B7332" />
              <stop offset="75%" stopColor="#3a3a3a" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
          </defs>

          {/* Circle ring - SMALLER with gold/black gradient */}
          <circle
            cx="50"
            cy="50"
            r="32"
            stroke="url(#ringGradient)"
            strokeWidth="2.5"
            fill="none"
          />

          {/* Gold checkmark - extends well beyond the circle */}
          <path
            d="M26 52L42 68L74 30"
            stroke="url(#checkGold)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>

        {/* CHECKS HAPPY text */}
        <h1 className="text-[28px] font-serif font-normal tracking-[0.15em] text-[#1a1a1a]">
          CHECKS HAPPY
        </h1>

        {/* Gold underline */}
        <div
          className="h-[2px] mt-3 mb-8"
          style={{
            width: '280px',
            background: 'linear-gradient(90deg, transparent 0%, #C9A962 15%, #D4B86A 50%, #C9A962 85%, transparent 100%)'
          }}
        />

        {/* Tagline */}
        <p className="text-lg font-serif text-[#4a4a4a] mb-10">
          Streamline Hair & Makeup Continuity
        </p>

        {/* Feature icons - BLACK, SOLID, BOLD */}
        <div className="flex items-center justify-center w-full max-w-md mb-12">
          {/* Capture - Camera icon - SOLID/BOLD */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Camera body - filled for solid look */}
              <path
                d="M4 18C4 15.79 5.79 14 8 14H14L18 8H38L42 14H48C50.21 14 52 15.79 52 18V44C52 46.21 50.21 48 48 48H8C5.79 48 4 46.21 4 44V18Z"
                fill="#1a1a1a"
              />
              {/* Camera lens - white circle */}
              <circle cx="28" cy="30" r="10" fill="#F5F3EE" />
              {/* Camera lens inner - black dot */}
              <circle cx="28" cy="30" r="5" fill="#1a1a1a" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Capture</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Track - Sync arrows icon - BOLDER */}
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
        {/* Sign In - Black background with white text */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-lg font-semibold text-lg transition-all duration-200
            bg-[#1a1a1a] text-white active:scale-[0.98]"
        >
          Sign In
        </button>

        {/* Create Account - Cream with black border */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-lg font-semibold text-lg transition-all duration-200
            border border-[#1a1a1a] text-[#1a1a1a] bg-[#F5F3EE] active:scale-[0.98]"
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
