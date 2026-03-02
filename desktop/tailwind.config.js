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
    },
  },
  plugins: [],
}
