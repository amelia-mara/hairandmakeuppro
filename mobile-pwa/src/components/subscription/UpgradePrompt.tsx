/**
 * UpgradePrompt — reusable bottom sheet for contextual upgrade prompts.
 *
 * Shown when a user tries to access a feature gated by their subscription tier
 * on their OWN project. Never shown on joined projects.
 *
 * Props: message (contextual copy), targetTier, onDismiss, onUpgrade.
 * Language is always positive and opportunity-focused — never "locked" or "restricted".
 */

import type { SubscriptionTier } from '@/types/subscription';

const TIER_PRICES: Record<string, string> = {
  artist: '£4.99/month',
  supervisor: '£9.99/month',
  designer: '£29.99/month',
};

const TIER_HIGHLIGHTS: Record<string, string[]> = {
  artist: [
    'Create your own project',
    'Offline mode with full sync',
    'Export continuity reports',
  ],
  supervisor: [
    'Create unlimited projects',
    'Invite and manage your team',
    'Budget and schedule tools',
  ],
  designer: [
    'AI script breakdown in Prep Happy',
    'Lookbook builder and production bible',
    'Timesheet approval and invoice signing',
  ],
};

interface UpgradePromptProps {
  message: string;
  targetTier: SubscriptionTier;
  onDismiss: () => void;
  onUpgrade: () => void;
}

export function UpgradePrompt({ message, targetTier, onDismiss, onUpgrade }: UpgradePromptProps) {
  const tierName = targetTier.charAt(0).toUpperCase() + targetTier.slice(1);
  const price = TIER_PRICES[targetTier] || '';
  const highlights = TIER_HIGHLIGHTS[targetTier] || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-primary, #FAF5EB)',
          borderRadius: '20px 20px 0 0',
          padding: '28px 24px 32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{
          width: '36px',
          height: '4px',
          borderRadius: '2px',
          backgroundColor: 'var(--border-medium, #D5CFC3)',
          margin: '0 auto 20px',
        }} />

        {/* Message */}
        <p style={{
          fontSize: '1rem',
          fontWeight: 400,
          color: 'var(--text-primary, #3D3526)',
          marginBottom: '16px',
          lineHeight: 1.5,
        }}>
          {message}
        </p>

        {/* Tier + price */}
        <p style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--text-heading, #2A2013)',
          marginBottom: '12px',
        }}>
          {tierName} — {price}
        </p>

        {/* Highlights */}
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {highlights.map((h) => (
            <li key={h} style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary, #6B5E4D)',
              paddingLeft: '20px',
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute',
                left: 0,
                color: 'var(--accent-gold, #D4943A)',
              }}>&#10003;</span>
              {h}
            </li>
          ))}
        </ul>

        {/* Designer trial note */}
        {targetTier === 'designer' && (
          <p style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted, #9C9488)',
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            Includes 1 month free trial. Cancel anytime.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={onUpgrade}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            fontSize: '0.9375rem',
            fontWeight: 500,
            backgroundColor: 'var(--accent-gold, #D4943A)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          Upgrade to {tierName}
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            fontSize: '0.8125rem',
            fontWeight: 400,
            backgroundColor: 'transparent',
            color: 'var(--text-muted, #9C9488)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
