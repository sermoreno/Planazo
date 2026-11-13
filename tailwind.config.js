import animate from 'tailwindcss-animate'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        coral: { DEFAULT: '#FF6B4A', 50: '#FFF1EC', 100: '#FFE0D6', 200: '#FFC2AF', 600: '#C2410C', 700: '#A3360A' },
        noche: { DEFAULT: '#1E2A4A', 600: '#3A4668', 400: '#5B6685' },
        crema: '#FFF8F2',
      },
      borderRadius: { card: '16px' },
      boxShadow: { soft: '0 2px 10px rgba(30,42,74,0.06), 0 8px 28px rgba(30,42,74,0.06)' },
    },
  },
  plugins: [animate],
}
