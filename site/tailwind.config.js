/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0A08',        // the dark, sultry base
        'ink-2': '#141210',    // raised panels on ink
        'ink-3': '#1E1A15',    // hairline fills on ink
        ivory: '#FFFBF5',      // the off-white / nude ground
        linen: '#F4EEE4',      // a warmer second ivory for banding
        sand: '#E7DDCD',       // hairlines on ivory
        gold: '#BCA47B',       // sampled from the logo
        'gold-deep': '#9C845C',
        'gold-light': '#D9C9A6',
        smoke: '#8E877C',      // muted text on ink
        stone: '#6B6358',      // muted text on ivory
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Jost', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { eyebrow: '0.28em', wide: '0.14em' },
      maxWidth: { page: '1240px' },
      transitionTimingFunction: { silk: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
}
