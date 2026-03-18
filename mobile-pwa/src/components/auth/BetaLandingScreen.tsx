import { useAuthStore } from '@/stores/authStore';

export function BetaLandingScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#F5EFE0', position: 'relative', overflow: 'hidden' }}
    >
      {/* Noise texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main content */}
      <div
        className="flex-1 flex flex-col items-center px-6 pt-14 pb-6"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Wordmark */}
        <h1 className="mb-1" style={{ fontSize: '32px', lineHeight: 1.1, textAlign: 'center' }}>
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              fontStyle: 'normal',
              color: '#4A3020',
            }}
          >
            Checks
          </span>{' '}
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              fontStyle: 'italic',
              color: '#E8621A',
            }}
          >
            Happy.
          </span>
        </h1>

        {/* Department pills */}
        <div className="flex items-center gap-2 mt-5 mb-4">
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(232, 98, 26, 0.1)',
              border: '1px solid rgba(232, 98, 26, 0.3)',
              color: '#E8621A',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            Hair and Makeup
          </span>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '20px',
              background: '#EDE4D0',
              border: '1px solid #DDD4C0',
              color: '#7A5C3A',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            Costume
          </span>
        </div>

        {/* Thin orange gradient rule */}
        <div
          style={{
            width: '100%',
            height: '1px',
            background: 'linear-gradient(to right, rgba(232, 98, 26, 0.3), transparent)',
            marginBottom: '16px',
          }}
        />

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: '15px',
            color: '#7A5C3A',
            textAlign: 'center',
            margin: '0 0 20px',
          }}
        >
          Your department, beautifully organised.
        </p>

        {/* Three value pillars */}
        <div className="flex items-center justify-center w-full mb-6" style={{ maxWidth: '300px' }}>
          {/* Capture */}
          <div className="flex flex-col items-center flex-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A3020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
                fontSize: '10px',
                color: '#4A3020',
                marginTop: '6px',
              }}
            >
              Capture
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '40px', background: '#DDD4C0' }} />

          {/* Track */}
          <div className="flex flex-col items-center flex-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A3020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
                fontSize: '10px',
                color: '#4A3020',
                marginTop: '6px',
              }}
            >
              Track
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '40px', background: '#DDD4C0' }} />

          {/* Collaborate */}
          <div className="flex flex-col items-center flex-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A3020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
                fontSize: '10px',
                color: '#4A3020',
                marginTop: '6px',
              }}
            >
              Collaborate
            </span>
          </div>
        </div>

        {/* Feature cards */}
        <div className="w-full space-y-3 mb-6" style={{ maxWidth: '340px' }}>
          {/* Card 1: Script Breakdown */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #DDD4C0',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: '9px',
                letterSpacing: '0.18em',
                color: '#E8621A',
                textTransform: 'uppercase',
              }}
            >
              SCRIPT BREAKDOWN
            </span>
            <div
              style={{
                width: '100%',
                height: '1px',
                background: 'linear-gradient(to right, rgba(74, 191, 176, 0.3), transparent)',
                margin: '8px 0',
              }}
            />
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
                fontSize: '13px',
                color: '#5A4030',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              AI-powered breakdown from your script. Characters, scenes, and continuity notes in minutes.
            </p>
          </div>

          {/* Card 2: Lookbook */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #DDD4C0',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: '9px',
                letterSpacing: '0.18em',
                color: '#E8621A',
                textTransform: 'uppercase',
              }}
            >
              LOOKBOOK
            </span>
            <div
              style={{
                width: '100%',
                height: '1px',
                background: 'linear-gradient(to right, rgba(74, 191, 176, 0.3), transparent)',
                margin: '8px 0',
              }}
            />
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
                fontSize: '13px',
                color: '#5A4030',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Every look, every character, every scene. One document your whole department works from.
            </p>
          </div>

          {/* Card 3: On-Set Tracking */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #DDD4C0',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: '9px',
                letterSpacing: '0.18em',
                color: '#E8621A',
                textTransform: 'uppercase',
              }}
            >
              ON-SET TRACKING
            </span>
            <div
              style={{
                width: '100%',
                height: '1px',
                background: 'linear-gradient(to right, rgba(74, 191, 176, 0.3), transparent)',
                margin: '8px 0',
              }}
            />
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
                fontSize: '13px',
                color: '#5A4030',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Log continuity, hours, and receipts from your phone. Syncs to Prep in real time.
            </p>
          </div>
        </div>

        {/* Private beta badge */}
        <div className="flex flex-col items-center mb-6">
          <span
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '20px',
              background: '#EDE4D0',
              border: '1px solid #E8621A',
              color: '#E8621A',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: '9px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            PRIVATE BETA
          </span>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
              fontSize: '12px',
              color: '#9A7A5A',
              marginTop: '8px',
            }}
          >
            Currently available by invite only.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="w-full space-y-3" style={{ maxWidth: '340px' }}>
          <button
            onClick={() => setScreen('beta-code')}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: '#E8621A',
              color: '#FFFFFF',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Join the Beta
          </button>
          <button
            onClick={() => setScreen('signin')}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: '1.5px solid #4A3020',
              background: 'transparent',
              color: '#4A3020',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </div>

        {/* Footer */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: '10px',
            color: '#9A7A5A',
            textAlign: 'center',
            marginTop: 'auto',
            paddingTop: '24px',
          }}
        >
          checkshappy.com
        </p>
      </div>
    </div>
  );
}
