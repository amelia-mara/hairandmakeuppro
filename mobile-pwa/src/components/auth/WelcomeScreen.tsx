import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* TICK OPTIONS PREVIEW - Different icon styles */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {/* 1. Simple stroke checkmark */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M30 50 L45 65 L70 35" stroke="#C9A962" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-xs font-bold">1</span>
          </div>

          {/* 2. Thick bold checkmark */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M28 52 L42 66 L72 32" stroke="#C9A962" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-xs font-bold">2</span>
          </div>

          {/* 3. Filled checkmark shape */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M25 50 L40 65 L75 28 L72 38 L40 58 L32 50 Z" fill="#C9A962" />
            </svg>
            <span className="text-xs font-bold">3</span>
          </div>

          {/* 4. Material Design style */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M30 50 L44 64 L70 34" stroke="#C9A962" strokeWidth="8" strokeLinecap="square" strokeLinejoin="miter" fill="none" />
            </svg>
            <span className="text-xs font-bold">4</span>
          </div>

          {/* 5. Thin elegant */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M28 52 L42 66 L74 30" stroke="#C9A962" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-xs font-bold">5</span>
          </div>

          {/* 6. Calligraphic brush stroke */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M24 48 L38 68 L42 72 L48 68 L76 26 L74 30 L46 64 L40 64 L28 50 Z" fill="#C9A962" />
            </svg>
            <span className="text-xs font-bold">6</span>
          </div>

          {/* 7. Double stroke effect */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M28 52 L42 66 L74 30" stroke="#A8893D" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M28 52 L42 66 L74 30" stroke="#D4B86A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-xs font-bold">7</span>
          </div>

          {/* 8. Swoosh checkmark */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M22 55 Q35 55, 42 68 Q55 50, 78 25" stroke="#C9A962" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-xs font-bold">8</span>
          </div>

          {/* 9. Tapered brush */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M22 50 L36 68 L44 76 L50 70 L78 24 L48 66 L42 70 L28 52 Z" fill="#C9A962" />
            </svg>
            <span className="text-xs font-bold">9</span>
          </div>

          {/* 10. Handwritten style */}
          <div className="flex flex-col items-center">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" />
              <path d="M24 54 Q32 54, 40 68 Q44 72, 46 70 Q60 50, 76 28" stroke="#C9A962" strokeWidth="6" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-xs font-bold">10</span>
          </div>
        </div>

        {/* CHECKS HAPPY text */}
        <h1 className="text-[34px] font-serif font-medium tracking-wide text-[#1a1a1a]">
          CHECKS HAPPY
        </h1>

        {/* Gold underline - thicker in middle with rustic texture */}
        <svg width="280" height="8" viewBox="0 0 280 8" className="mt-3 mb-8">
          <defs>
            <linearGradient id="underlineGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A962" stopOpacity="0" />
              <stop offset="15%" stopColor="#C9A962" />
              <stop offset="50%" stopColor="#D4B86A" />
              <stop offset="85%" stopColor="#C9A962" />
              <stop offset="100%" stopColor="#C9A962" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Main stroke - thicker in middle, tapered at ends */}
          <path
            d="M 0 4
               Q 70 3, 140 2
               Q 210 3, 280 4"
            stroke="url(#underlineGold)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          {/* Subtle texture strokes for rustic effect */}
          <path
            d="M 40 4.5 Q 80 3.5, 120 4
               M 160 3.5 Q 200 4.5, 240 4"
            stroke="#B8983A"
            strokeWidth="0.5"
            fill="none"
            opacity="0.4"
          />
        </svg>

        {/* Tagline */}
        <p className="text-lg font-serif text-[#4a4a4a] mb-10">
          Streamline Hair & Makeup Continuity
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
              <circle cx="28" cy="30" r="10" fill="#F5F3EE" />
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
        {/* Sign In - Black background with white text */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded font-semibold text-lg transition-all duration-200
            bg-[#1a1a1a] text-white active:scale-[0.98]"
        >
          Sign In
        </button>

        {/* Create Account - Cream with black border */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded font-semibold text-lg transition-all duration-200
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
