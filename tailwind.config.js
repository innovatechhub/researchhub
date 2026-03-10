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
        }
      },
      boxShadow: {
        card: '0 12px 30px -14px rgba(16, 83, 59, 0.35)'
      }
    }
  },
  plugins: []
};
