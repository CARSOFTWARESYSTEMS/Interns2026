/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Partner-themable: values are CSS variables (r g b channels) set by
        // src/tenant/theme.ts; defaults (the original blue) live in index.css.
        brand: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(n => [n, `rgb(var(--brand-${n}) / <alpha-value>)`]),
        ),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
