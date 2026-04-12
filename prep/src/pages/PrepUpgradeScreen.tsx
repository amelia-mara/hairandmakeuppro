/**
 * PrepUpgradeScreen — shown when a non-Designer user tries to access Prep Happy.
 *
 * Full-screen gate that explains what Designer includes and offers an upgrade CTA.
 * Matches Prep Happy design system (cream background, DM Sans, warm tones).
 */

interface PrepUpgradeScreenProps {
  onSignOut: () => void;
}

export function PrepUpgradeScreen({ onSignOut }: PrepUpgradeScreenProps) {
  return (
    <div
      className="ambient-light"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        {/* Brand */}
        <div className="brand-logo" style={{ fontSize: '1.75rem', marginBottom: '40px' }}>
          <span className="brand-logo-checks">Checks</span>{' '}
          <span className="brand-logo-happy">Happy.</span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 400,
          color: 'var(--text-heading)',
          marginBottom: '32px',
          lineHeight: 1.4,
        }}>
          Prep Happy is included in the Designer plan.
        </h1>

        {/* Feature list */}
        <ul style={{
          textAlign: 'left',
          listStyle: 'none',
          padding: 0,
          margin: '0 0 40px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {[
            'AI script breakdown with scene and character detection',
            'Lookbook builder with look assignments per scene',
            'Full production bible with SFX register',
            'Department budget planning and expense tracking',
            'Timesheet approval and invoice countersigning',
          ].map((feature) => (
            <li
              key={feature}
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                paddingLeft: '24px',
                position: 'relative',
              }}
            >
              <span style={{
                position: 'absolute',
                left: 0,
                color: 'var(--accent-gold, #D4943A)',
              }}>
                &#10003;
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          className="btn-gold"
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: '10px',
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: '12px',
          }}
          onClick={() => {
            // Open pricing/upgrade flow — for now, link to account settings
            window.open('/prep/pricing', '_blank');
          }}
        >
          Upgrade to Designer
        </button>

        <p style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginBottom: '24px',
        }}>
          Includes 1 month free trial. Cancel anytime.
        </p>

        {/* Secondary actions */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            onClick={onSignOut}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
