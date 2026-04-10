/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.html",
    "./static/js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        dark: {
          900: '#0f0f1a',
          800: '#1a1a2e',
          700: '#242442',
          600: '#2d2d55',
          500: '#363668',
        },
        primary: '#8b5cf6',
        'primary-light': '#a78bfa',
        accent: '#c084fc',
        success: '#10b981',
        'success-light': '#34d399',
        warning: '#f59e0b',
        danger: '#ef4444',
      }
    },
  },
  plugins: [],
}
