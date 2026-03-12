import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col" style={{
      background: 'linear-gradient(180deg, #fffdfb 0%, #fefcfb 30%, #faf6f0 70%, #f5efe5 100%)'
    }}>
      {/* Department pill */}
      <div className="flex items-center justify-center pt-14 px-8">
        <span className="px-5 py-2 rounded-pill text-sm font-medium text-teal border border-teal/30 bg-teal/5">
          Hair &amp; Makeup &amp; Costume
        </span>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Text logo — stacked with overlap */}
        <div className="flex flex-col items-center mb-8">
          <span className="text-[46px] leading-none font-serif font-bold text-[#2A1A08]">
            Checks
          </span>
          <span className="text-[46px] leading-none font-serif font-bold italic text-gold -mt-3">
            Happy.
          </span>
        </div>

        {/* Tagline */}
        <p className="text-lg text-[#5A3E28] mb-10">
          Your personal onset assistant
        </p>

        {/* Feature icons — bold, filled style */}
        <div className="flex items-center justify-center w-full max-w-md mb-12">
          {/* Capture — bold filled camera */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Camera body */}
              <path
                d="M4 18C4 15.79 5.79 14 8 14H14L18 8H38L42 14H48C50.21 14 52 15.79 52 18V44C52 46.21 50.21 48 48 48H8C5.79 48 4 46.21 4 44V18Z"
                fill="#2A1A08"
              />
              {/* Lens outer ring */}
              <circle cx="28" cy="30" r="11" fill="#fefcfb" />
              {/* Lens inner */}
              <circle cx="28" cy="30" r="6" fill="#2A1A08" />
              {/* Lens highlight */}
              <circle cx="28" cy="30" r="2.5" fill="#fefcfb" />
            </svg>
            <span className="text-sm font-medium text-[#2A1A08]">Capture</span>
          </div>

          {/* Divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Track — bold filled sync arrows */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Top arc */}
              <path
                d="M28 8C16.954 8 8 16.954 8 28c0 4.5 1.5 8.6 4 12"
                stroke="#2A1A08"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Bottom arc */}
              <path
                d="M28 48c11.046 0 20-8.954 20-20 0-4.5-1.5-8.6-4-12"
                stroke="#2A1A08"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head bottom-left */}
              <polygon points="4,36 15,43 16,30" fill="#2A1A08" />
              {/* Arrow head top-right */}
              <polygon points="52,20 41,13 40,26" fill="#2A1A08" />
            </svg>
            <span className="text-sm font-medium text-[#2A1A08]">Track</span>
          </div>

          {/* Divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Collaborate — bold filled people */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Center person head */}
              <circle cx="28" cy="14" r="7" fill="#2A1A08" />
              {/* Center person body */}
              <path d="M16 46v-8c0-6.627 5.373-12 12-12s12 5.373 12 12v8" fill="#2A1A08" />
              {/* Left person head */}
              <circle cx="11" cy="20" r="5.5" fill="#2A1A08" />
              {/* Left person body */}
              <path d="M0 46v-6c0-5.523 4.477-10 10-10 2.2 0 4.2.7 5.8 1.9" fill="#2A1A08" />
              {/* Right person head */}
              <circle cx="45" cy="20" r="5.5" fill="#2A1A08" />
              {/* Right person body */}
              <path d="M56 46v-6c0-5.523-4.477-10-10-10-2.2 0-4.2.7-5.8 1.9" fill="#2A1A08" />
            </svg>
            <span className="text-sm font-medium text-[#2A1A08]">Collaborate</span>
          </div>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-8 pb-10 space-y-4">
        {/* Sign In — solid orange, pill-shaped */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-pill font-semibold text-lg transition-all duration-200
            bg-gold text-white active:scale-[0.98] shadow-md hover:bg-gold-dark"
        >
          Sign In
        </button>

        {/* Create Account — outlined, pill-shaped */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-pill font-semibold text-lg transition-all duration-200
            border-2 border-[#2A1A08] text-[#2A1A08] bg-transparent active:scale-[0.98]"
        >
          Create Account
        </button>

        {/* Join a Team */}
        <div className="pt-6 flex items-center justify-center gap-4">
          <div className="flex-1 h-px bg-[#c5c0b5]" />
          <button
            className="text-sm text-[#7a7a7a] hover:text-[#5A3E28] transition-colors whitespace-nowrap"
            onClick={() => setScreen('signup')}
          >
            Join a Team
          </button>
          <div className="flex-1 h-px bg-[#c5c0b5]" />
        </div>
      </div>
    </div>
  );
}
