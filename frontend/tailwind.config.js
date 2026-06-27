/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#FAF9F6',
        surface: '#FFFFFF',
        primaryText: '#1C1C1E',
        mutedText: '#767680',
        goldCustom: '#B2904C',
        indigoCustom: '#635A94',
        borderCustom: '#E5E5EA',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
