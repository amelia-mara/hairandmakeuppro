import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, type Theme } from '@/stores/themeStore';

export function TopBar() {
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    const order: Theme[] = ['dark', 'light', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header
      className="h-16 flex items-center justify-between px-8 border-b"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-1">
        <span
          className="text-sm font-semibold tracking-[0.15em] uppercase"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
        >
          PREP
        </span>
        <span
          className="text-sm font-bold italic"
          style={{ color: 'var(--gold-primary)', fontFamily: 'var(--font-serif)' }}
        >
          HAPPY
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon size={18} />
        </button>

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{
            background: 'linear-gradient(135deg, #d4b06a 0%, #a07628 100%)',
            color: '#1a1510',
          }}
        >
          AM
        </div>
      </div>
    </header>
  );
}
