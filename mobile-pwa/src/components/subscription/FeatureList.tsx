import { clsx } from 'clsx';

export interface FeatureListProps {
  features: string[];
  variant?: 'default' | 'compact';
  showCheckmarks?: boolean;
}

export function FeatureList({
  features,
  variant = 'default',
  showCheckmarks = true,
}: FeatureListProps) {
  return (
    <ul className={clsx(
      'space-y-2',
      variant === 'compact' && 'space-y-1.5'
    )}>
      {features.map((feature, index) => (
        <li
          key={index}
          className={clsx(
            'flex items-start gap-2',
            variant === 'compact' ? 'text-xs' : 'text-sm',
            'text-text-secondary'
          )}
        >
          {showCheckmarks && (
            <span className="flex-shrink-0 mt-0.5">
              <svg
                className={clsx(
                  'text-gold',
                  variant === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4'
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

// Component for showing features that will be lost on downgrade
export interface FeatureLossListProps {
  features: string[];
}

export function FeatureLossList({ features }: FeatureLossListProps) {
  if (features.length === 0) return null;

  return (
    <ul className="space-y-2">
      {features.map((feature, index) => (
        <li
          key={index}
          className="flex items-start gap-2 text-sm text-red-600"
        >
          <span className="flex-shrink-0 mt-0.5">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
