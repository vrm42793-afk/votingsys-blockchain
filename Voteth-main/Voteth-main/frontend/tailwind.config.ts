import type { Config } from 'tailwindcss'

/**
 * VotEth 2.0 — Tailwind CSS Design Token System
 *
 * This file defines the complete design token system for VotEth 2.0.
 * All design decisions are centralized here. Components MUST use these
 * tokens — never arbitrary values (e.g., w-[347px]).
 *
 * Design Philosophy:
 * - Deep navy/dark primary palette — conveys trust and authority
 * - Electric violet accent — blockchain/tech identity
 * - Semantic status colors — green (success), amber (warning), red (danger)
 * - Clean typography hierarchy using Inter (system/brand) + Mono for hashes
 *
 * See: VotEth Development Bible, Volume XVII (Design System)
 */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      // ===================================================================
      // COLOR PALETTE
      // Brand: Deep navy + Electric violet + Trust grays
      // ===================================================================
      colors: {
        // Brand primary — deep navy / light slate dynamically adjusted
        brand: {
          950: 'var(--color-brand-950)',
          900: 'var(--color-brand-900)',
          850: 'var(--color-brand-850)',
          800: 'var(--color-brand-800)',
          750: 'var(--color-brand-750)',
          700: 'var(--color-brand-700)',
          600: 'var(--color-brand-600)',
          500: 'var(--color-brand-500)',
          400: 'var(--color-brand-400)',
          300: 'var(--color-brand-300)',
          200: 'var(--color-brand-200)',
          100: 'var(--color-brand-100)',
          50:  'var(--color-brand-50)',
        },

        // Accent — dynamically swapped brand accent theme (purple, blue, emerald, rose)
        accent: {
          950: 'var(--color-accent-950)',
          900: 'var(--color-accent-900)',
          800: 'var(--color-accent-800)',
          700: 'var(--color-accent-700)',
          600: 'var(--color-accent-600)',
          500: 'var(--color-accent-500)',
          400: 'var(--color-accent-400)',
          300: 'var(--color-accent-300)',
          200: 'var(--color-accent-200)',
          100: 'var(--color-accent-100)',
          50:  'var(--color-accent-50)',
        },

        // Semantic — success / green
        success: {
          900: '#064E3B',
          700: '#047857',
          600: '#059669',
          500: '#10B981',  // Redesign success green
          400: '#34D399',
          100: '#D1FAE5',
          50:  '#ECFDF5',
        },

        // Semantic — warning / amber
        warning: {
          900: '#78350F',
          700: '#B45309',
          600: '#D97706',
          500: '#F59E0B',  // Redesign warning orange
          400: '#FBBF24',
          100: '#FEF3C7',
          50:  '#FFFBEB',
        },

        // Semantic — danger / red
        danger: {
          900: '#7F1D1D',
          700: '#B91C1C',
          600: '#DC2626',
          500: '#EF4444',  // Redesign danger red
          400: '#F87171',
          100: '#FEE2E2',
          50:  '#FEF2F2',
        },

        // Neutral — cool grays for text and borders
        neutral: {
          950: 'var(--color-neutral-950)',
          900: 'var(--color-neutral-900)',
          800: 'var(--color-neutral-800)',
          700: 'var(--color-neutral-700)',
          600: 'var(--color-neutral-600)',
          500: 'var(--color-neutral-500)',
          400: 'var(--color-neutral-400)',
          300: 'var(--color-neutral-300)',
          200: 'var(--color-neutral-200)',
          100: 'var(--color-neutral-100)',
          50:  'var(--color-neutral-50)',
        },
      },

      // ===================================================================
      // TYPOGRAPHY
      // Inter for UI copy; JetBrains Mono for blockchain hashes/addresses
      // ===================================================================
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },

      fontSize: {
        '3xs':  ['0.5rem',   { lineHeight: '0.75rem' }],
        '2xs':  ['0.625rem', { lineHeight: '0.875rem' }],
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.5rem' }],
        'lg':   ['1.125rem', { lineHeight: '1.75rem' }],
        'xl':   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':  ['1.5rem',   { lineHeight: '2rem' }],
        '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':  ['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl':  ['3rem',     { lineHeight: '1.1' }],
        '6xl':  ['3.75rem',  { lineHeight: '1' }],
      },

      // ===================================================================
      // SPACING
      // Base-8 spacing scale with some extra density tokens
      // ===================================================================
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '26':  '6.5rem',
        '30':  '7.5rem',
      },

      // ===================================================================
      // BORDER RADIUS
      // ===================================================================
      borderRadius: {
        'sm':   '0.375rem',
        DEFAULT: '0.5rem',
        'md':   '0.625rem',
        'lg':   '0.75rem',
        'xl':   '1rem',
        '2xl':  '1.5rem',
        '3xl':  '2rem',
      },

      // ===================================================================
      // SHADOWS
      // Dark-mode optimized shadows using brand colors
      // ===================================================================
      boxShadow: {
        'sm':     '0 1px 2px 0 rgb(0 0 0 / 0.25)',
        DEFAULT:  '0 2px 8px 0 rgb(0 0 0 / 0.3)',
        'md':     '0 4px 16px 0 rgb(0 0 0 / 0.35)',
        'lg':     '0 8px 32px 0 rgb(0 0 0 / 0.4)',
        'xl':     '0 16px 48px 0 rgb(0 0 0 / 0.45)',
        'accent': '0 0 24px 0 rgb(108 71 255 / 0.35)',
        'glow':   '0 0 40px 0 rgb(108 71 255 / 0.2)',
        'none':   'none',
      },

      // ===================================================================
      // ANIMATION
      // Micro-animations for enhanced UX (subtle, not distracting)
      // ===================================================================
      transitionDuration: {
        DEFAULT: '200ms',
        '150': '150ms',
        '300': '300ms',
        '500': '500ms',
      },

      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },

      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(8px)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-accent': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(108 71 255 / 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgb(108 71 255 / 0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      animation: {
        'fade-in':      'fade-in 200ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'fade-out':     'fade-out 200ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'slide-up':     'slide-up 300ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'scale-in':     'scale-in 200ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'pulse-accent': 'pulse-accent 2s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
      },

      // ===================================================================
      // BACKDROP BLUR
      // Used for glassmorphism effects (modal overlays, nav)
      // ===================================================================
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      },

      // ===================================================================
      // Z-INDEX
      // Explicit z-index scale to prevent stacking context chaos
      // ===================================================================
      zIndex: {
        'below':   '-1',
        'base':    '0',
        'raised':  '10',
        'dropdown': '20',
        'sticky':  '30',
        'overlay': '40',
        'modal':   '50',
        'toast':   '60',
        'tooltip': '70',
      },

      // ===================================================================
      // SCREEN BREAKPOINTS
      // Mobile-first, standard breakpoints
      // ===================================================================
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },

  // Dark mode strategy — class-based for explicit control
  darkMode: 'class',

  plugins: [],
}

export default config
