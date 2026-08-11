/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#070a12',
          800: '#0e1424',
          700: '#172036',
          600: '#23304d'
        },
        brand: {
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca'
        }
      }
    },
  },
  plugins: [],
}
