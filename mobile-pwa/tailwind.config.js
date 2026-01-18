/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C9A962',
          dark: '#B8962E',
          light: '#D4BC7D',
          50: '#FAF7F0',
          100: '#F5EFE1',
          200: '#EBE0C4',
          300: '#E1D1A7',
          400: '#D4BC7D',
          500: '#C9A962',
          600: '#B8962E',
          700: '#8F7424',
          800: '#66531A',
          900: '#3D3210',
        },
        background: '#f5f4f2',
        card: '#ffffff',
        'input-bg': '#f8f7f5',
        border: '#e8e6e1',
        'text-primary': '#333333',
        'text-secondary': '#666666',
        'text-muted': '#888888',
        'text-light': '#999999',
        'text-placeholder': '#aaaaaa',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#f44336',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
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
        'button': '12px',
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
      },
    },
  },
  plugins: [],
}
