import { useState } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui';
import { TierCard } from './TierCard';
import { PriceToggle } from './PriceToggle';
import { ComparisonModal } from './ComparisonModal';
import { FeatureLossList } from './FeatureList';
import {
  SUBSCRIPTION_TIERS,
  getDowngradeWarnings,
  isTierHigher,
  BETA_MODE,
} from '@/types/subscription';
import type { SubscriptionTier, BillingPeriod } from '@/types/subscription';

export interface SelectPlanScreenProps {
  // For onboarding flow - no current tier
  isOnboarding?: boolean;
  // Current tier for returning users (from Settings)
  currentTier?: SubscriptionTier;
  // Called when user selects a tier (for onboarding)
  onSelectTier?: (tier: SubscriptionTier, billingPeriod: BillingPeriod) => void;
  // Called when user wants to continue with free (skip)
  onSkip?: () => void;
  // Called when user wants to go back
  onBack?: () => void;
  // Loading state (for payment processing)
  isLoading?: boolean;
}

export function SelectPlanScreen({
  isOnboarding = true,
  currentTier,
  onSelectTier,
  onSkip,
  onBack,
  isLoading = false,
}: SelectPlanScreenProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(
    isOnboarding ? null : currentTier || null
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [showComparison, setShowComparison] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);

  // Get downgrade warnings if applicable
  const downgradeWarnings =
    currentTier && selectedTier && isTierHigher(currentTier, selectedTier)
      ? getDowngradeWarnings(currentTier, selectedTier)
      : [];

  const handleTierSelect = (tierId: SubscriptionTier) => {
    setSelectedTier(tierId);

    // Show downgrade warning if applicable
    if (currentTier && isTierHigher(currentTier, tierId)) {
      setShowDowngradeWarning(true);
    } else {
      setShowDowngradeWarning(false);
    }
  };

  const handleContinue = () => {
    if (!selectedTier) return;

    // For onboarding, proceed with tier selection
    if (onSelectTier) {
      onSelectTier(selectedTier, billingPeriod);
    }
  };

  const handleSkip = () => {
    // Continue with free (trainee) tier
    if (onSkip) {
      onSkip();
    } else if (onSelectTier) {
      onSelectTier('trainee', 'monthly');
    }
  };

  // Check if user can proceed
  const canProceed = selectedTier !== null && !isLoading;

  // Determine if this is an upgrade or downgrade from current plan
  const isUpgrade =
    currentTier && selectedTier && isTierHigher(selectedTier, currentTier);
  const isDowngrade =
    currentTier && selectedTier && isTierHigher(currentTier, selectedTier);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center px-4 py-3 safe-top border-b border-border bg-card">
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2"
            aria-label="Go back"
          >
            <svg
              className="w-6 h-6 text-text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className={clsx('flex-1', onBack ? 'text-center pr-10' : 'text-center')}>
          <h1 className="text-lg font-bold text-text-primary">Choose Your Plan</h1>
        </div>
      </header>

      {/* Subheader text */}
      <div className="px-6 pt-4 pb-2 text-center">
        <p className="text-sm text-text-secondary">
          {BETA_MODE
            ? 'All features are available during beta testing. Select your preferred tier.'
            : 'Select the tier that fits your role. You can upgrade anytime.'
          }
        </p>
      </div>

      {/* Billing period toggle - Hidden in beta mode */}
      {!BETA_MODE && (
        <div className="px-6 py-4 flex justify-center">
          <PriceToggle
            value={billingPeriod}
            onChange={setBillingPeriod}
            showPerProject={false}
          />
        </div>
      )}

      {/* Tier cards - scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-4 max-w-md mx-auto">
          {SUBSCRIPTION_TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              billingPeriod={billingPeriod}
              isSelected={selectedTier === tier.id}
              isCurrentPlan={currentTier === tier.id}
              onSelect={handleTierSelect}
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Compare all features link */}
        <div className="text-center mt-6">
          <button
            onClick={() => setShowComparison(true)}
            className="text-sm text-gold font-medium hover:underline"
          >
            Compare all features
          </button>
        </div>

        {/* FAQ / Reassurance */}
        <div className="mt-6 text-center space-y-1">
          {BETA_MODE ? (
            <>
              <p className="text-xs text-text-muted">Full access during beta</p>
              <p className="text-xs text-text-muted">Thank you for testing!</p>
            </>
          ) : (
            <>
              <p className="text-xs text-text-muted">Cancel anytime</p>
              <p className="text-xs text-text-muted">7-day free trial on paid plans</p>
            </>
          )}
          <button className="text-xs text-gold hover:underline">
            Questions? Contact us
          </button>
        </div>

        {/* Downgrade warning */}
        {showDowngradeWarning && downgradeWarnings.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
            <h4 className="text-sm font-semibold text-red-700 mb-2">
              You'll lose access to:
            </h4>
            <FeatureLossList features={downgradeWarnings} />
            <p className="text-xs text-red-600 mt-3">
              Changes take effect at the end of your billing period.
            </p>
          </div>
        )}
      </div>

      {/* Sticky bottom button area */}
      <div className="sticky bottom-0 left-0 right-0 p-4 pb-safe-bottom bg-card border-t border-border">
        <div className="max-w-md mx-auto space-y-3">
          {/* Continue button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleContinue}
            disabled={!canProceed}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Processing...
              </span>
            ) : selectedTier === 'trainee' ? (
              'Start Free'
            ) : isDowngrade ? (
              'Downgrade Plan'
            ) : isUpgrade ? (
              'Upgrade Plan'
            ) : selectedTier ? (
              'Subscribe'
            ) : (
              'Select a Plan'
            )}
          </Button>

          {/* Skip option for onboarding */}
          {isOnboarding && (
            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-text-muted hover:text-text-secondary"
              disabled={isLoading}
            >
              Continue with Free for now
            </button>
          )}

          {/* Manage billing link for existing subscribers */}
          {!isOnboarding && currentTier && currentTier !== 'trainee' && (
            <button className="w-full text-center text-sm text-gold hover:underline">
              Manage billing
            </button>
          )}
        </div>
      </div>

      {/* Comparison Modal */}
      <ComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        currentTier={currentTier}
      />
    </div>
  );
}
