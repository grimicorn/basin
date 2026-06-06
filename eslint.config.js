import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

const nuxtGlobals = {
  defineNuxtConfig: "readonly",
  defineNuxtPlugin: "readonly",
  defineNuxtRouteMiddleware: "readonly",
  definePageMeta: "readonly",
  useNuxtApp: "readonly",
  useRuntimeConfig: "readonly",
  useRoute: "readonly",
  useRouter: "readonly",
  useFetch: "readonly",
  useAsyncData: "readonly",
  useState: "readonly",
  navigateTo: "readonly",
  ref: "readonly",
  computed: "readonly",
  watch: "readonly",
  onMounted: "readonly",
};

export default [
  {
    ignores: [".nuxt/**", ".output/**", "dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.ts", "**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: [".vue"],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...nuxtGlobals,
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "vue/html-self-closing": "off",
    },
  },
  {
    files: ["app/pages/**/*.vue", "app/layouts/**/*.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  eslintConfigPrettier,
];
