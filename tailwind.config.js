/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg0: '#060810',
        bg1: '#0b0e18',
        bg2: '#111420',
        bg3: '#181c2e',
        bg4: '#1e2338',
        border: '#252a40',
        border2: '#2e3550',
        text0: '#e8eaf6',
        text1: '#a8adc8',
        text2: '#5c6285',
        accent: '#4f8ef7',
        accent2: '#7c6ff7',
        green: '#34d399',
        amber: '#fbbf24',
        red: '#f87171',
        pink: '#f472b6',
      },
    },
  },
  plugins: [],
}

