/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./public/mobile/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#12090a',
          rail: '#0f0807',
          panel: '#1a1214',
          accent: '#aba19b',
        },
        primary: {
          gold: '#ffd45f',
          orange: '#ff7248',
          cyan: '#4be4d4',
          goldDark: '#f4b92f',
          orangeDark: '#ff6734',
          cyanDark: '#23bfd4',
        },
        text: {
          main: '#fff4e7',
          muted: '#bdaea0',
          soft: '#f0e2d2',
        }
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Outfit"', 'sans-serif'],
        display: ['"Arial Black"', '"Outfit"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
