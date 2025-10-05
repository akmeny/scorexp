/**
 * Tailwind yapılandırma dosyası.
 * Tüm src klasöründeki JS/JSX dosyalarını tarar ve `darkMode`'u `class` olarak ayarlar.
 */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};