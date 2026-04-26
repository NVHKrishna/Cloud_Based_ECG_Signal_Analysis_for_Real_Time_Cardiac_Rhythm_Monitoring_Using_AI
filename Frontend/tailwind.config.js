/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ecg: {
          green: '#10b981', // Emerald 500 - more clinical
          'green-dim': '#059669',
          'green-glow': 'rgba(16, 185, 129, 0.15)',
          dark: '#f8fafc', // Slate 50 - Background
          'dark-card': '#ffffff', // White - Cards
          'dark-border': '#e2e8f0', // Slate 200
          'dark-surface': '#f1f5f9', // Slate 100
          cyan: '#0ea5e9', // Sky 500
          warning: '#f59e0b', // Amber 500
          critical: '#ef4444', // Red 500
          muted: '#94a3b8', // Slate 400
          text: '#1e293b', // Slate 800 - Main Text
          'text-dim': '#64748b', // Slate 600 - Muted Text
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.6s ease-out',
        'fade-in': 'fadeIn 0.8s ease-out',
        'heartbeat': 'heartbeat 1.2s ease-in-out infinite',
        'scan-line': 'scanLine 2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(16, 185, 129, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.1)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.05)' },
          '56%': { transform: 'scale(1)' },
        },
        scanLine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      boxShadow: {
        'ecg-green': '0 4px 12px rgba(16, 185, 129, 0.2)',
        'ecg-card': '0 4px 20px rgba(148, 163, 184, 0.08)',
        'ecg-inner': 'inset 0 1px 0 rgba(255,255,255,1)',
      },
    },
  },
  plugins: [],
}
