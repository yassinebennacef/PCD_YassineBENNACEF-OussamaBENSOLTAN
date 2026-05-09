/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          50:  '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        surface: {
          0:   '#ffffff',
          50:  '#fafaf9',
          100: '#f4f3ef',
          200: '#eae8e2',
          300: '#d4d1c9',
        },
      },
      fontFamily: {
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        serif:   ['"Instrument Serif"', 'Georgia', 'serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        'md':  '10px',
        'lg':  '12px',
        'xl':  '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        'xs':  '0 1px 2px 0 rgba(0,0,0,0.05)',
        'sm':  '0 1px 4px 0 rgba(0,0,0,0.06)',
        'md':  '0 4px 16px -2px rgba(0,0,0,0.08)',
        'lg':  '0 10px 32px -4px rgba(0,0,0,0.10)',
        'card': '0 2px 8px 0 rgba(0,0,0,0.06)',
        'card-hover': '0 8px 28px -4px rgba(37,99,235,0.14)',
      },
    },
  },
  plugins: [],
}
