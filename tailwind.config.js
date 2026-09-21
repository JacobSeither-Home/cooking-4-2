/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base:    '#0D0608',
        surface: '#1A0B11',
        raised:  '#241320',
        border:  '#3D1A22',
        gold:    { DEFAULT: '#C8973A', light: '#E8B85A', dark: '#8A6020' },
        pink:    { DEFAULT: '#E8628A', light: '#F08FAF', dark: '#A03458' },
        cream:   { DEFAULT: '#F5E6D3', muted: '#8A6A70' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'deco-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C8973A' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'gold':  '0 0 20px rgba(200, 151, 58, 0.25)',
        'pink':  '0 0 20px rgba(232, 98, 138, 0.25)',
        'inner-gold': 'inset 0 0 30px rgba(200, 151, 58, 0.08)',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'shimmer':  'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '0%, 100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
}
