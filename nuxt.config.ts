import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  future: { compatibilityVersion: 4 },
  nitro: {
    preset: "netlify",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
