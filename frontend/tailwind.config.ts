import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        black: '#0D0D0D',
        surface: '#111111',
        'surface-2': '#1A1A1A',
        'surface-3': '#222222',
        red: {
          DEFAULT: '#FF2E2E',
          dim: '#CC2424',
          glow: 'rgba(255,46,46,0.15)',
          'glow-strong': 'rgba(255,46,46,0.3)',
        },
        white: {
          DEFAULT: '#F5F5F5',
          dim: '#AAAAAA',
          muted: '#666666',
          faint: '#333333',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        serif: ['Crimson Pro', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.8s ease forwards',
        'fade-up': 'fade-up 0.6s ease forwards',
        'grain': 'grain 8s steps(10) infinite',
        'blink': 'blink 1s step-end infinite',
        'slide-up': 'slide-up 0.4s ease forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(255,46,46,0.3)' },
          '50%': { boxShadow: '0 0 28px rgba(255,46,46,0.7)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'grain': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-2%, -3%)' },
          '20%': { transform: 'translate(3%, 1%)' },
          '30%': { transform: 'translate(-1%, 4%)' },
          '40%': { transform: 'translate(2%, -2%)' },
          '50%': { transform: 'translate(-3%, 3%)' },
          '60%': { transform: 'translate(1%, -4%)' },
          '70%': { transform: 'translate(3%, 2%)' },
          '80%': { transform: 'translate(-2%, 1%)' },
          '90%': { transform: 'translate(2%, 3%)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      backgroundImage: {
        'red-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,46,46,0.4) 50%, transparent 100%)',
        'dark-gradient': 'linear-gradient(180deg, #0D0D0D 0%, #111111 100%)',
        'card-gradient': 'linear-gradient(135deg, #1A1A1A 0%, #111111 100%)',
        'red-gradient': 'linear-gradient(135deg, #FF2E2E 0%, #CC2424 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
