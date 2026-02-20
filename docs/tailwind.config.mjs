/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Open Sans", "system-ui", "sans-serif"],
        heading: ["Roboto Slab", "Georgia", "serif"],
      },
      colors: {
        accent: {
          DEFAULT: "#0055B8",
          dark: "#003d85",
          light: "#3b82f6",
        },
        highlight: {
          DEFAULT: "#f4673b",
          light: "#f7855f",
          dark: "#d94f25",
        },
        navy: {
          DEFAULT: "#092E5B",
          light: "#0e3f7a",
          dark: "#061e3d",
        },
        brand: {
          blue: "#0055B8",
          navy: "#092E5B",
          theme: "#023471",
          orange: "#f4673b",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
