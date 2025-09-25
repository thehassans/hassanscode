/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1rem',
          md: '1.25rem',
          lg: '1.5rem',
          xl: '2rem',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.08)'
      }
    },
  },
  plugins: [forms(), typography()],
}
