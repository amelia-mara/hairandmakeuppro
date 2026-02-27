import { useState, useCallback, useRef, type TouchEvent } from 'react';
import { useTutorialStore, TUTORIAL_TOTAL_STEPS } from '@/stores/tutorialStore';
import { TutorialStep } from './TutorialStep';

// SVG icons for each step
function CheckmarkLogo() {
  return (
    <svg className="w-12 h-12 text-gold" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ProjectCardsIcon() {
  return (
    <svg className="w-12 h-12 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function TodayScreenIcon() {
  return (
    <svg className="w-12 h-12 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function BreakdownIcon() {
  return (
    <svg className="w-12 h-12 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.375" />
    </svg>
  );
}

function CaptureIcon() {
  return (
    <svg className="w-12 h-12 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </svg>
  );
}

function TimesheetIcon() {
  return (
    <svg className="w-12 h-12 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const tutorialSteps = [
  {
    title: 'Welcome to Checks Happy',
    subtitle: 'Your on-set continuity companion',
    description: 'Keep track of every detail — from hair and makeup to timesheets and call sheets — all in one place.',
    icon: <CheckmarkLogo />,
  },
  {
    title: 'Join or Create a Project',
    subtitle: 'Get started with your production',
    description: 'If your HOD has shared a project code, tap Join. If you\'re setting up a new production, tap Create.',
    icon: <ProjectCardsIcon />,
  },
  {
    title: 'See What\'s Shooting',
    subtitle: 'The Today tab',
    description: 'The Today tab shows your current shooting day — scenes, call times, and progress at a glance.',
    icon: <TodayScreenIcon />,
  },
  {
    title: 'Your Scene Breakdown',
    subtitle: 'The Breakdown tab',
    description: 'Every scene in the production, with characters and continuity status. Tap any scene to capture.',
    icon: <BreakdownIcon />,
  },
  {
    title: 'Capture the Details',
    subtitle: 'Continuity photography',
    description: 'For each character in each scene, photograph front, left, right, and back. Add notes and flags for sweat, blood, dirt, and more.',
    icon: <CaptureIcon />,
  },
  {
    title: 'Log Your Time',
    subtitle: 'The Hours tab',
    description: 'Track daily call and wrap times. The app calculates overtime, premiums, and BECTU rates automatically.',
    icon: <TimesheetIcon />,
  },
  {
    title: "You're All Set",
    subtitle: 'Ready to go',
    description: 'Join a project to get started, or explore the app at your own pace.',
    icon: <CheckmarkLogo />,
  },
];

interface TutorialOverlayProps {
  onOpenGuide?: () => void;
}

export function TutorialOverlay({ onOpenGuide }: TutorialOverlayProps) {
  const { currentStep, nextStep, prevStep, skipTutorial, completeTutorial } = useTutorialStore();
  const [direction, setDirection] = useState<'left' | 'right'>('left');
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch handling for swipe
  const touchStartX = useRef<number | null>(null);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_TOTAL_STEPS - 1;

  const goNext = useCallback(() => {
    if (animating) return;
    if (isLastStep) {
      completeTutorial();
      return;
    }
    setDirection('left');
    setAnimating(true);
    setTimeout(() => {
      nextStep();
      setAnimating(false);
    }, 200);
  }, [animating, isLastStep, completeTutorial, nextStep]);

  const goPrev = useCallback(() => {
    if (animating || isFirstStep) return;
    setDirection('right');
    setAnimating(true);
    setTimeout(() => {
      prevStep();
      setAnimating(false);
    }, 200);
  }, [animating, isFirstStep, prevStep]);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  const handleFinish = () => {
    completeTutorial();
  };

  const handleViewGuide = () => {
    completeTutorial();
    onOpenGuide?.();
  };

  const step = tutorialSteps[currentStep];
  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div
        ref={containerRef}
        className="bg-card rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Skip button - top right */}
        {!isLastStep && (
          <div className="flex justify-end px-4 pt-4">
            <button
              onClick={skipTutorial}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip Tutorial
            </button>
          </div>
        )}

        {/* Step content */}
        <div
          className={`pt-6 pb-4 transition-all duration-200 ${
            animating
              ? direction === 'left'
                ? 'opacity-0 -translate-x-4'
                : 'opacity-0 translate-x-4'
              : 'opacity-100 translate-x-0'
          }`}
        >
          {isLastStep ? (
            /* Skip button placeholder to keep consistent spacing */
            <div className="h-5 mb-4" />
          ) : null}
          <TutorialStep
            title={step.title}
            subtitle={step.subtitle}
            description={step.description}
            icon={step.icon}
          />
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-4">
          {Array.from({ length: TUTORIAL_TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'bg-gold w-4'
                  : i < currentStep
                  ? 'bg-gold/40'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="px-6 pb-6 space-y-3">
          {isLastStep ? (
            <>
              <button
                onClick={handleFinish}
                className="w-full py-3.5 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform"
              >
                Start Using Checks Happy
              </button>
              {onOpenGuide && (
                <button
                  onClick={handleViewGuide}
                  className="w-full text-center text-sm text-gold font-medium py-2"
                >
                  View User Guide
                </button>
              )}
            </>
          ) : (
            <div className="flex gap-3">
              {!isFirstStep && (
                <button
                  onClick={goPrev}
                  className="flex-1 py-3 rounded-button bg-gray-100 text-text-secondary font-medium active:scale-[0.98] transition-transform"
                >
                  Back
                </button>
              )}
              <button
                onClick={isFirstStep ? goNext : goNext}
                className={`${isFirstStep ? 'w-full' : 'flex-1'} py-3.5 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform`}
              >
                {isFirstStep ? 'Get Started' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
