/** @type {import('tailwindcss').Config} */
module.exports = {
  // Rutas actualizadas para la estructura de Expo Router
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
