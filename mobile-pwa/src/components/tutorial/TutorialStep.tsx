import type { ReactNode } from 'react';

interface TutorialStepProps {
  title: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
}

export function TutorialStep({ title, subtitle, description, icon }: TutorialStepProps) {
  return (
    <div className="flex flex-col items-center text-center px-6">
      {/* Illustration area */}
      <div className="w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center mb-6">
        {icon}
      </div>

      {/* Title */}
      <h2
        className="text-2xl font-bold text-text-primary mb-2"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {title}
      </h2>

      {/* Subtitle */}
      <p className="text-sm text-text-muted mb-4">{subtitle}</p>

      {/* Description */}
      <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
        {description}
      </p>
    </div>
  );
}
