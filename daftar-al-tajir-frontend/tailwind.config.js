/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#2B8A3E',
          600: '#2B8A3E',
          700: '#237032',
          800: '#166534',
          900: '#14532d',
        },
        secondary: {
          50: '#E7F5FF',
          100: '#D0EBFF',
          200: '#A5D8FF',
          300: '#74C0FC',
          400: '#4DABF7',
          500: '#1C7ED6',
          600: '#1C7ED6',
          700: '#1971C2',
          800: '#1864AB',
          900: '#14558F',
        },
        neutral: {
          bg: '#FFFFFF',
          card: '#F8F9FA',
          cardAlt: '#F1F3F5',
          text: '#212529',
          textSub: '#6C757D',
          border: '#DEE2E6',
        }
      },
      fontFamily: {
        arabic: ['IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
