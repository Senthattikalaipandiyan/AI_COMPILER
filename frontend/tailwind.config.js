/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          // Backwards compatibility mappings mapped to light surfaces
          950: '#FFFFFF',
          900: '#F8FAFC',
          850: '#F1F5F9',
          800: '#E2E8F0',
          750: '#E2E8F0',
          700: '#CBD5E1',
          650: '#94A3B8',
        },
        matter: '#EA580C',
        antiMatter: '#0284C7',
        brand: {
          cyan: '#0284C7',
          blue: '#2563EB',
          orange: '#EA580C',
          emerald: '#059669',
          purple: '#9333EA',
          amber: '#D97706',
          rose: '#E11D48',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px -3px rgba(2, 132, 199, 0.25)',
        'glow-emerald': '0 0 15px -3px rgba(5, 150, 105, 0.25)',
        'glow-purple': '0 0 15px -3px rgba(147, 51, 234, 0.25)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
