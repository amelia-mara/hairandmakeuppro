import { clsx } from 'clsx';
import { Badge, Button } from '@/components/ui';
import type { TierInfo, BillingPeriod, SubscriptionTier } from '@/types/subscription';
import { formatPrice, formatMonthlyEquivalent, BETA_MODE } from '@/types/subscription';
import { FeatureList } from './FeatureList';

export interface TierCardProps {
  tier: TierInfo;
  billingPeriod: BillingPeriod;
  isSelected?: boolean;
  isCurrentPlan?: boolean;
  onSelect: (tierId: SubscriptionTier) => void;
  disabled?: boolean;
}

export function TierCard({
  tier,
  billingPeriod,
  isSelected = false,
  isCurrentPlan = false,
  onSelect,
  disabled = false,
}: TierCardProps) {
  const { id, name, description, pricing, featureList, isPopular, isPremium } = tier;

  // Determine price to display based on billing period
  const getDisplayPrice = (): string => {
    if (id === 'trainee') return 'Free';

    if (billingPeriod === 'per_project' && id === 'designer' && pricing.perProject) {
      return formatPrice(pricing.perProject, pricing.currencySymbol);
    }

    if (billingPeriod === 'yearly') {
      return formatPrice(pricing.yearly, pricing.currencySymbol);
    }

    return formatPrice(pricing.monthly, pricing.currencySymbol);
  };

  // Get billing period label
  const getBillingLabel = (): string => {
    if (id === 'trainee') return 'forever';

    if (billingPeriod === 'per_project' && id === 'designer') {
      return 'per project';
    }

    if (billingPeriod === 'yearly') {
      return '/year';
    }

    return '/month';
  };

  // Get monthly equivalent for yearly billing
  const getMonthlyEquivalent = (): string | null => {
    if (id === 'trainee' || billingPeriod !== 'yearly') return null;
    return `${formatMonthlyEquivalent(pricing.yearly, pricing.currencySymbol)}/mo`;
  };

  // Determine button text
  const getButtonText = (): string => {
    if (isCurrentPlan) return 'Current Plan';
    if (id === 'trainee') return 'Start Free';
    return 'Subscribe';
  };

  // Determine button variant
  const getButtonVariant = (): 'primary' | 'outline' => {
    if (isSelected || isCurrentPlan) return 'primary';
    return 'outline';
  };

  const monthlyEquivalent = getMonthlyEquivalent();

  return (
    <div
      className={clsx(
        'relative rounded-xl p-4 transition-all duration-200',
        'border-2',
        {
          // Selected state - gold border with subtle gold background
          'border-gold bg-gold-50/50': isSelected && !isCurrentPlan,
          // Current plan state
          'border-gold bg-gold-50/30': isCurrentPlan,
          // Premium tier styling
          'border-gold/30 bg-gradient-to-br from-gold-50/20 to-transparent': isPremium && !isSelected && !isCurrentPlan,
          // Default state
          'border-border bg-card': !isSelected && !isCurrentPlan && !isPremium,
          // Hover state
          'hover:border-gold/50': !isSelected && !isCurrentPlan,
        }
      )}
    >
      {/* Badges row */}
      <div className="flex items-center gap-2 mb-3">
        {isPopular && (
          <Badge variant="gold" size="md">
            Most Popular
          </Badge>
        )}
        {isPremium && (
          <Badge variant="gold" size="md">
            Premium
          </Badge>
        )}
        {isCurrentPlan && (
          <Badge variant="success" size="md">
            Current Plan
          </Badge>
        )}
      </div>

      {/* Tier name */}
      <h3 className={clsx(
        'text-lg font-bold mb-1',
        isPremium ? 'gold-text-gradient' : 'text-text-primary'
      )}>
        {name}
      </h3>

      {/* Description */}
      <p className="text-sm text-text-secondary mb-4">
        {description}
      </p>

      {/* Price - Hidden in beta mode */}
      {BETA_MODE ? (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gold">Beta Access</span>
            <Badge variant="gold" size="sm">Free</Badge>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Full access during beta testing
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className={clsx(
              'text-3xl font-bold',
              id === 'trainee' ? 'text-text-primary' : 'text-gold'
            )}>
              {getDisplayPrice()}
            </span>
            <span className="text-sm text-text-muted">
              {getBillingLabel()}
            </span>
          </div>
          {monthlyEquivalent && (
            <p className="text-xs text-text-muted mt-1">
              ({monthlyEquivalent} billed annually)
            </p>
          )}
        </div>
      )}

      {/* Features */}
      <FeatureList features={featureList} />

      {/* Select button */}
      <Button
        variant={getButtonVariant()}
        size="md"
        fullWidth
        onClick={() => onSelect(id)}
        disabled={disabled || isCurrentPlan}
        className="mt-4"
      >
        {getButtonText()}
      </Button>

      {/* Selected indicator */}
      {isSelected && !isCurrentPlan && (
        <div className="absolute top-3 right-3">
          <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
