/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./App.jsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#000000',
          800: '#0a0a0a',
          700: '#1a1a1a',
        }
      }
    },
  },
  plugins: [],
}
