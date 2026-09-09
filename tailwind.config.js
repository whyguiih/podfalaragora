/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
          accentHover: '#79b8ff',
          danger: '#f85149',
          success: '#3fb950',
          warning: '#d29922',
          text: '#e6edf3',
          textMuted: '#8b949e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}