/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#261642',
        'bg-secondary': '#3d2764',
        'bg-card': '#52367c',
        'bg-overlay': '#1c1132',
        'gold-primary': '#c9a84c',
        'gold-light': '#e8c97a',
        'gold-dark': '#a07830',
        'text-cream': '#f0e6d3',
        'text-muted': '#b8a898',
        'text-disabled': '#7a6a7a',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'Helvetica Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: { glass: '12px' },
      animation: {
        twinkle: 'twinkle 3s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        'sos-pulse': 'sos-pulse 1.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
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
      },
    },
  },
  plugins: [],
};
