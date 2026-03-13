/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Core brand colours */
        gold: {
          DEFAULT: '#E8621A',       /* Orange Primary — CTAs, primary actions */
          dark: '#C4522A',
          light: '#F0882A',         /* Orange Warm — hover states */
          50: '#FFF5ED',
          100: '#FFE8D6',
          200: '#FECCA8',
          300: '#FDAC74',
          400: '#F0882A',           /* Orange Warm */
          500: '#E8621A',           /* Orange Primary */
          600: '#C4522A',
          700: '#A04020',
          800: '#7A3218',
          900: '#4A3020',
        },
        amber: {
          DEFAULT: '#F5A623',       /* Amber — accents, badges, warnings */
        },
        'brand-gold': '#D4943A',    /* Gold — icons, decorative elements */
        teal: {
          DEFAULT: '#4ABFB0',       /* Teal — success, accent contrast, links */
        },
        peach: '#F2C4A0',           /* Peach — tag backgrounds, soft highlights */
        cream: {
          DEFAULT: '#F5EFE0',       /* Cream Base — page background */
          dark: '#EDE4D0',          /* Cream Dark — section backgrounds, borders */
        },
        // Theme colors using CSS variables (respects dark mode)
        background: 'var(--color-background)',
        card: 'var(--color-card)',
        'input-bg': 'var(--color-input-bg)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'text-light': 'var(--color-text-light)',
        'text-placeholder': 'var(--color-text-placeholder)',
        success: '#4ABFB0',         /* Teal — success states */
        warning: '#F5A623',         /* Amber — warning states */
        error: '#C4522A',           /* Gold Dark — error states */
        // Dark mode specific colors - warm brown solids
        'dark-bg': '#1A1208',
        'dark-bg-secondary': '#201808',
        'dark-bg-tertiary': '#251A0A',
        'dark-card': '#2E2010',
        'dark-card-hover': '#3A2A16',
        'dark-input-bg': '#251A0A',
        'dark-border': 'rgba(212, 148, 58, 0.08)',
        'dark-border-focus': 'rgba(232, 98, 26, 0.35)',
        'dark-text-primary': '#F5EFE0',
        'dark-text-secondary': '#C4A882',
        'dark-text-muted': '#9A8068',
        'dark-text-light': '#7A5C3A',
      },
      fontFamily: {
        sans: [
          '"DM Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        serif: [
          '"Playfair Display"',
          'Georgia',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
      },
      fontSize: {
        'section': ['10px', { letterSpacing: '0.1em', fontWeight: '700' }],
        'field-label': ['10px', { letterSpacing: '0.06em', fontWeight: '600' }],
        'character-name': ['22px', { fontWeight: '700' }],
      },
      borderRadius: {
        'card': '12px',
        'input': '8px',
        'button': '8px',
        'pill': '25px',
      },
      spacing: {
        'card-padding': '16px',
        'nav-height': '60px',
        'safe-bottom': '100px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'nav': '0 -2px 10px rgba(0, 0, 0, 0.05)',
        // Dark mode shadows - clean, no glow
        'dark-card': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'dark-card-hover': '0 8px 30px rgba(0, 0, 0, 0.4)',
        'dark-nav': '0 -2px 20px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
