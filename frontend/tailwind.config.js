/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware tokens (driven by CSS variables in index.css)
        base: 'rgb(var(--c-base) / <alpha-value>)',       // page background
        card: 'rgb(var(--c-card) / <alpha-value>)',       // panels & inputs
        parchment: 'rgb(var(--c-parchment) / <alpha-value>)', // soft sub-panels
        line: 'rgb(var(--c-line) / <alpha-value>)',       // borders
        fg: 'rgb(var(--c-fg) / <alpha-value>)',           // primary text
        copper: 'rgb(var(--c-gold) / <alpha-value>)',     // champagne gold accent
        'copper-dark': 'rgb(var(--c-gold-deep) / <alpha-value>)',
        // Brand constants (identical in both themes)
        ink: '#0D0A07',
        'ink-soft': '#1D1710',
        cream: '#FFFBF5',
        sage: '#6B7D68',
        'sage-light': '#2A2F28',
        clay: '#C8B89A',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.08), 0 4px 18px rgba(0,0,0,0.10)',
        pop: '0 8px 44px rgba(0,0,0,0.45)',
      },
    },
  },
}
