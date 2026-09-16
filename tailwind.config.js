/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Stadium at night: near-black blue, with two signal colors that never
        // mean anything else — gold for "at lock" numbers, pink for live ones.
        ink: '#0A0E13',
        panel: '#121922',
        raised: '#19222D',
        line: 'rgba(255,255,255,0.08)',
        text: '#E8EDF2',
        muted: '#8A97A6',
        gold: { DEFAULT: '#F5B82E', soft: 'rgba(245,184,46,0.12)' },
        live: { DEFAULT: '#FF3D71', soft: 'rgba(255,61,113,0.12)' },
        win: { DEFAULT: '#2FD17A', soft: 'rgba(47,209,122,0.12)' },
        loss: { DEFAULT: '#F2555A', soft: 'rgba(242,85,90,0.12)' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-barlow)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
