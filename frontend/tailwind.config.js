/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C1A17',
        'ink-soft': '#2A2722',
        cream: '#F7F3EC',
        parchment: '#EFE8DB',
        line: '#E3DACA',
        copper: '#B4622D',
        'copper-dark': '#934E20',
        sage: '#5C6F5A',
        'sage-light': '#EDF0EA',
        clay: '#C8B89A',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,26,23,0.05), 0 4px 16px rgba(28,26,23,0.06)',
        pop: '0 8px 40px rgba(28,26,23,0.18)',
      },
    },
  },
  plugins: [],
}
