import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui';
import {
  getTierById,
  formatPrice,
  SUBSCRIPTION_TIERS,
} from '@/types/subscription';
import type { SubscriptionTier } from '@/types/subscription';

export interface SubscriptionSectionProps {
  onChangePlan: () => void;
}

export function SubscriptionSection({ onChangePlan }: SubscriptionSectionProps) {
  const { user, subscription } = useAuthStore();

  if (!user) return null;

  const currentTier = getTierById(user.tier as SubscriptionTier);

  if (!currentTier) return null;

  // Format the billing period
  const getBillingInfo = () => {
    if (!subscription.billingPeriod || user.tier === 'trainee') {
      return 'Free forever';
    }

    const price = subscription.billingPeriod === 'yearly'
      ? currentTier.pricing.yearly
      : subscription.billingPeriod === 'per_project'
        ? currentTier.pricing.perProject
        : currentTier.pricing.monthly;

    const period = subscription.billingPeriod === 'yearly'
      ? '/year'
      : subscription.billingPeriod === 'per_project'
        ? '/project'
        : '/month';

    return `${formatPrice(price || 0, currentTier.pricing.currencySymbol)}${period}`;
  };

  // Format next billing date
  const getNextBillingDate = () => {
    if (!subscription.currentPeriodEndsAt || user.tier === 'trainee') {
      return null;
    }

    const date = new Date(subscription.currentPeriodEndsAt);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const nextBillingDate = getNextBillingDate();

  return (
    <section className="mb-6">
      <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
        SUBSCRIPTION
      </h2>
      <div className="card">
        {/* Current plan header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text-primary">
              {currentTier.name}
            </span>
            {currentTier.isPopular && (
              <Badge variant="gold" size="sm">Popular</Badge>
            )}
            {currentTier.isPremium && (
              <Badge variant="gold" size="sm">Premium</Badge>
            )}
          </div>
          {subscription.status === 'active' && (
            <Badge variant="success" size="sm">Active</Badge>
          )}
          {subscription.status === 'trialing' && (
            <Badge variant="gold" size="sm">Trial</Badge>
          )}
        </div>

        {/* Plan description */}
        <p className="text-sm text-text-secondary mb-4">
          {currentTier.description}
        </p>

        {/* Billing info */}
        <div className="space-y-2 py-3 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Current plan</span>
            <span className="text-sm font-medium text-text-primary">
              {getBillingInfo()}
            </span>
          </div>

          {nextBillingDate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-muted">Next billing</span>
              <span className="text-sm text-text-primary">{nextBillingDate}</span>
            </div>
          )}

          {subscription.cancelAtPeriodEnd && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">
                Your subscription will cancel at the end of this billing period.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-border space-y-2">
          <button
            onClick={onChangePlan}
            className="w-full py-2.5 px-4 bg-gold-50/50 border border-gold/20 rounded-lg text-sm font-medium text-gold hover:bg-gold-100/50 transition-colors"
          >
            {user.tier === 'trainee' ? 'Upgrade Plan' : 'Change Plan'}
          </button>

          {user.tier !== 'trainee' && subscription.status === 'active' && (
            <button className="w-full py-2.5 px-4 text-sm text-text-muted hover:text-text-secondary transition-colors">
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Quick feature limits */}
      <div className="mt-3 card bg-input-bg/50">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
          Your Limits
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-lg font-bold text-text-primary">
              {currentTier.features.maxPhotosPerProject === -1
                ? 'Unlimited'
                : currentTier.features.maxPhotosPerProject}
            </p>
            <p className="text-xs text-text-muted">Photos/project</p>
          </div>
          <div>
            <p className="text-lg font-bold text-text-primary">
              {currentTier.features.maxProjects === -1
                ? 'Unlimited'
                : currentTier.features.maxProjects}
            </p>
            <p className="text-xs text-text-muted">Active projects</p>
          </div>
        </div>
      </div>
    </section>
  );
}
