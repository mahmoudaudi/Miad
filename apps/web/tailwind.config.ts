import type { Config } from 'tailwindcss';

/**
 * Miad — Minimal Editorial design system.
 * Warm off-white canvas, ink text, muted gold accent, serif display type.
 * Semantic brand tokens, thin borders, restrained motion, and accessible controls.
 */
const config: Config = {
  content: {
    relative: true,
    files: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  },
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: '#682032',
          foreground: '#FFFFFF',
        },
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        'surface-muted': '#F6F3EF',
        elevated: '#FFFFFF',
        border: 'rgb(var(--border) / <alpha-value>)',
        ai: '#704D79',
        success: '#2F6B45',
        warning: '#875000',
        destructive: '#BA1A1A',
        surface: '#FFFFFF',
        ink: '#171717',
        muted: '#686461',
        line: 'rgb(var(--border) / <alpha-value>)',
        accent: '#80694D',
        coal: '#171717',
        error: '#ba1a1a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif', '"Segoe UI"', 'Tahoma', 'Arial'],
        wordmark: ['"MetroScript"', '"Pinyon Script"', 'cursive'],
        display: ['"Playfair Display"', 'Georgia', 'serif', '"Segoe UI"', 'Tahoma'],
        'display-mobile': ['"Playfair Display"', 'Georgia', 'serif', '"Segoe UI"', 'Tahoma'],
        'headline-lg': ['"Playfair Display"', 'Georgia', 'serif', '"Segoe UI"', 'Tahoma'],
        'headline-lg-mobile': ['"Playfair Display"', 'Georgia', 'serif', '"Segoe UI"', 'Tahoma'],
        'headline-md': ['"Playfair Display"', 'Georgia', 'serif', '"Segoe UI"', 'Tahoma'],
        'headline-sm': ['"Playfair Display"', 'Georgia', 'serif', '"Segoe UI"', 'Tahoma'],
        title: ['Inter', 'sans-serif', '"Segoe UI"', 'Tahoma'],
        'body-lg': ['Inter', 'sans-serif', '"Segoe UI"', 'Tahoma'],
        'body-md': ['Inter', 'sans-serif', '"Segoe UI"', 'Tahoma'],
        'body-sm': ['Inter', 'sans-serif', '"Segoe UI"', 'Tahoma'],
        'label-md': ['Inter', 'sans-serif', '"Segoe UI"', 'Tahoma'],
        'label-sm': ['Inter', 'sans-serif', '"Segoe UI"', 'Tahoma'],
        'mono-metric': ['Inter', 'sans-serif', '"Segoe UI"', 'Tahoma'],
      },
      fontSize: {
        display: ['56px', { lineHeight: '64px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'display-mobile': [
          '36px',
          { lineHeight: '42px', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        'headline-lg': [
          '40px',
          { lineHeight: '48px', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        'headline-lg-mobile': [
          '28px',
          { lineHeight: '34px', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        'headline-md': [
          '28px',
          { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        'headline-sm': ['20px', { lineHeight: '28px', letterSpacing: '0em', fontWeight: '500' }],
        title: ['16px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '26px', letterSpacing: '0em', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0em', fontWeight: '400' }],
        'label-md': ['13px', { lineHeight: '18px', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
        'mono-metric': ['24px', { lineHeight: '28px', letterSpacing: '0em', fontWeight: '500' }],
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
        margin: '2rem',
        'margin-mobile': '1rem',
        gutter: '1.5rem',
        'gutter-mobile': '1rem',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(23, 23, 23, 0.04), 0 4px 16px rgba(23, 23, 23, 0.04)',
        lift: '0 2px 4px rgba(23, 23, 23, 0.05), 0 12px 32px rgba(23, 23, 23, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
