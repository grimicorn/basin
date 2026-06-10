import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const mainCss = fileURLToPath(
  new URL("./app/assets/css/main.css", import.meta.url),
);

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  modules: ["@clerk/nuxt", "@sentry/nuxt/module"],
  sentry: {
    sourceMapsUploadOptions: {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },
  clerk: {
    skipServerMiddleware: true,
  },
  runtimeConfig: {
    databaseUrl: "",
    googleClientId: "",
    googleClientSecret: "",
  },
  devtools: { enabled: true },
  future: { compatibilityVersion: 4 },
  nitro: {
    preset: "netlify",
  },
  css: [mainCss],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
      exclude: ["@electric-sql/pglite"],
    },
  },
  app: {
    head: {
      title: "Reader — all your feeds, one place",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "Every feed you follow — articles, podcasts, videos, posts — in one quiet, chronological place.",
        },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap",
        },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='14' y='16' width='36' height='9' rx='4.5' fill='%23b3a3ff'/%3E%3Crect x='11' y='28' width='42' height='9' rx='4.5' fill='%238c74ff'/%3E%3Crect x='16' y='40' width='32' height='9' rx='4.5' fill='%237c5cff'/%3E%3C/svg%3E",
        },
      ],
    },
  },
  routeRules: {
    // Exact redirect
    "/": { redirect: "/dashboard" },
  },
});
