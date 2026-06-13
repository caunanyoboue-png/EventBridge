/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette d'origine (inchangée)
        'bg-primary': '#261642',
        'bg-secondary': '#3d2764',
        'bg-card': '#52367c',
        'bg-overlay': '#1c1132',
        'gold-primary': '#d4af37',
        'gold-light': '#e8c97a',
        'gold-dark': '#a07830',
        'text-cream': '#f0e6d3',
        'text-muted': '#b8a898',
        'text-disabled': '#7a6a7a',
        // Variations étendues — nuances dérivées de la palette d'origine
        'night': '#0f0a1e',
        'night-deep': '#160e2c',
        'plum': '#6b4a9e',
        'plum-light': '#8a67c0',
        'orchid': '#a98ed6',
        'gold-pale': '#f5e6c4',
        'gold-deep': '#7d5a20',
        'rose-gold': '#d4a37a',
        'champagne': '#f7edd8',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Manrope', 'Helvetica Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: { glass: '12px' },
      animation: {
        twinkle: 'twinkle 3s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        'sos-pulse': 'sos-pulse 1.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease-out both',
        'scale-in': 'scale-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-left': 'slide-left 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'gold-sweep': 'gold-sweep 1.1s cubic-bezier(0.65, 0, 0.35, 1) both',
        'draw-line': 'draw-line 1.6s ease-out forwards',
        aurora: 'aurora 14s ease-in-out infinite alternate',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'sos-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(220,38,38,0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(220,38,38,0.8), 0 0 50px rgba(220,38,38,0.3)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(201,168,76,0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(201,168,76,0.6), 0 0 40px rgba(201,168,76,0.2)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-left': {
          from: { opacity: '0', transform: 'translateX(32px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'gold-sweep': {
          '0%': { transform: 'translateX(-100%) skewX(-12deg)' },
          '100%': { transform: 'translateX(220%) skewX(-12deg)' },
        },
        'draw-line': {
          from: { strokeDashoffset: 'var(--draw-length, 600)' },
          to: { strokeDashoffset: '0' },
        },
        aurora: {
          '0%': { transform: 'translate(-8%, -4%) scale(1)' },
          '50%': { transform: 'translate(6%, 5%) scale(1.12)' },
          '100%': { transform: 'translate(-4%, 8%) scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
