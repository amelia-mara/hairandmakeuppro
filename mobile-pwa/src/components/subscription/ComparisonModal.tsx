import { BottomSheet } from '@/components/ui';
import { clsx } from 'clsx';
import { SUBSCRIPTION_TIERS } from '@/types/subscription';
import type { SubscriptionTier } from '@/types/subscription';

export interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: SubscriptionTier;
}

interface FeatureRow {
  label: string;
  trainee: string | boolean;
  artist: string | boolean;
  supervisor: string | boolean;
  designer: string | boolean;
}

const COMPARISON_FEATURES: FeatureRow[] = [
  {
    label: 'Photos per project',
    trainee: '50',
    artist: '500',
    supervisor: '1,000',
    designer: 'Unlimited',
  },
  {
    label: 'Projects',
    trainee: '3',
    artist: '10',
    supervisor: '25',
    designer: 'Unlimited',
  },
  {
    label: 'Archived projects',
    trainee: '1',
    artist: 'Unlimited',
    supervisor: '15',
    designer: 'Unlimited',
  },
  {
    label: 'Offline mode',
    trainee: false,
    artist: true,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Export PDF reports',
    trainee: false,
    artist: true,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Personal templates',
    trainee: false,
    artist: true,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Create projects',
    trainee: false,
    artist: false,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Team management',
    trainee: false,
    artist: false,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Team invite codes',
    trainee: false,
    artist: false,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Character progression',
    trainee: false,
    artist: false,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Shooting schedule',
    trainee: false,
    artist: false,
    supervisor: true,
    designer: true,
  },
  {
    label: 'Team photo storage',
    trainee: false,
    artist: false,
    supervisor: false,
    designer: true,
  },
  {
    label: 'Desktop web access',
    trainee: false,
    artist: false,
    supervisor: false,
    designer: true,
  },
  {
    label: 'Pre-production breakdown',
    trainee: false,
    artist: false,
    supervisor: false,
    designer: true,
  },
  {
    label: 'Character design docs',
    trainee: false,
    artist: false,
    supervisor: false,
    designer: true,
  },
  {
    label: 'Production books export',
    trainee: false,
    artist: false,
    supervisor: false,
    designer: true,
  },
  {
    label: 'Budget & scheduling',
    trainee: false,
    artist: false,
    supervisor: false,
    designer: true,
  },
];

const tierOrder: SubscriptionTier[] = ['trainee', 'artist', 'supervisor', 'designer'];

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-gold"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      className="w-4 h-4 text-text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function ComparisonModal({ isOpen, onClose, currentTier }: ComparisonModalProps) {
  const tiers = SUBSCRIPTION_TIERS;

  const renderValue = (value: string | boolean, tierId: SubscriptionTier) => {
    if (typeof value === 'boolean') {
      return value ? <CheckIcon /> : <CrossIcon />;
    }
    return (
      <span className={clsx(
        'text-xs font-medium',
        tierId === currentTier ? 'text-gold' : 'text-text-secondary'
      )}>
        {value}
      </span>
    );
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Compare Plans"
      height="full"
    >
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[500px]">
          {/* Header */}
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 pr-4 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Feature
              </th>
              {tiers.map((tier) => (
                <th
                  key={tier.id}
                  className={clsx(
                    'text-center py-3 px-2 text-xs font-bold uppercase tracking-wide',
                    tier.id === currentTier ? 'text-gold' : 'text-text-primary'
                  )}
                >
                  {tier.name}
                  {tier.id === currentTier && (
                    <div className="text-[9px] text-gold font-normal mt-0.5">Current</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Pricing row */}
          <tbody>
            <tr className="border-b border-border bg-gold-50/30">
              <td className="py-3 pr-4 text-sm font-medium text-text-primary">
                Price
              </td>
              {tiers.map((tier) => (
                <td
                  key={tier.id}
                  className={clsx(
                    'text-center py-3 px-2',
                    tier.id === currentTier ? 'bg-gold-50/50' : ''
                  )}
                >
                  <span className={clsx(
                    'text-sm font-bold',
                    tier.id === 'trainee' ? 'text-text-primary' : 'text-gold'
                  )}>
                    {tier.pricing.monthly === 0 ? 'Free' : `£${tier.pricing.monthly.toFixed(2)}`}
                  </span>
                  {tier.pricing.monthly > 0 && (
                    <span className="text-[10px] text-text-muted block">/month</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Feature rows */}
            {COMPARISON_FEATURES.map((feature, index) => (
              <tr
                key={feature.label}
                className={clsx(
                  'border-b border-border',
                  index % 2 === 0 ? 'bg-transparent' : 'bg-input-bg/30'
                )}
              >
                <td className="py-2.5 pr-4 text-sm text-text-secondary">
                  {feature.label}
                </td>
                {tierOrder.map((tierId) => (
                  <td
                    key={tierId}
                    className={clsx(
                      'text-center py-2.5 px-2',
                      tierId === currentTier ? 'bg-gold-50/30' : ''
                    )}
                  >
                    <div className="flex justify-center">
                      {renderValue(feature[tierId], tierId)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-text-muted text-center">
          All prices in GBP. Cancel anytime. 7-day free trial on paid plans.
        </p>
      </div>
    </BottomSheet>
  );
}
