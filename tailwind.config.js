/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effcf6',
          100: '#c8f5e1',
          200: '#98e9c5',
          300: '#63d8a4',
          400: '#37c286',
          500: '#1fa56d',
          600: '#148356',
          700: '#116848',
          800: '#10533b',
          900: '#0f4532'
        },
        // Portal palette taken from the DOMA-TECH mockups (navy sidebar, blue-tinted panels).
        navy: {
          50: '#f3f6fc',
          100: '#e4ecfa',
          200: '#cfdcf5',
          300: '#a9bfe8',
          500: '#2f5aa8',
          600: '#1d438a',
          700: '#12326b',
          800: '#0c2552',
          900: '#08264d',
          950: '#061b3a'
        }
      },
      boxShadow: {
        card: '0 12px 30px -14px rgba(16, 83, 59, 0.35)',
        soft: '0 1px 3px rgba(8, 38, 77, 0.08), 0 8px 24px -12px rgba(8, 38, 77, 0.18)'
      }
    }
  },
  plugins: []
};
