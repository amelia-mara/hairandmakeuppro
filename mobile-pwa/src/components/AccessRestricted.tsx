/**
 * AccessRestricted — shown when a feature is toggled off for the current
 * user on a joined project.
 *
 * Neutral, warm tone. Not an error. No upgrade prompt — this is set by
 * the project owner, not by the user's subscription tier.
 */

interface AccessRestrictedProps {
  /** Optional override message. Default is generic. */
  message?: string;
}

export function AccessRestricted({ message }: AccessRestrictedProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      minHeight: '200px',
    }}>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary, #6B5E4D)',
        lineHeight: 1.6,
        maxWidth: '280px',
      }}>
        {message || "This feature isn't available to you on this project."}
      </p>
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted, #9C9488)',
        marginTop: '8px',
      }}>
        Contact your project manager if you think this is a mistake.
      </p>
    </div>
  );
}
