/* useAppearance — theme + visual tweaks, persisted to localStorage and
   applied to <html> via data-* attributes and CSS custom properties.
   Singleton: every component shares one reactive instance. */
import { reactive, watch } from "vue";

export const ACCENTS = {
  violet: { a: "oklch(0.6 0.17 285)", s: "oklch(0.54 0.18 285)" },
  blue: { a: "oklch(0.62 0.15 245)", s: "oklch(0.56 0.16 245)" },
  teal: { a: "oklch(0.64 0.11 195)", s: "oklch(0.58 0.12 195)" },
  amber: { a: "oklch(0.71 0.13 72)", s: "oklch(0.65 0.14 72)" },
  rose: { a: "oklch(0.63 0.18 14)", s: "oklch(0.57 0.19 14)" },
};

const STORAGE_KEY = "reader.appearance";

const DEFAULTS = {
  theme: "system", // system | light | dark
  accent: "violet", // key of ACCENTS
  reading: "mono", // mono | serif
  density: "cozy", // compact | cozy | comfortable
  radius: "sharp", // sharp | default | round
  loadingStyle: "both", // skeleton | fade | both
};

const state = reactive({ ...DEFAULTS });
let initialized = false;

function applyToDom() {
  if (!import.meta.client) return;
  const r = document.documentElement;

  if (state.theme === "system") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", state.theme);

  r.setAttribute("data-reading", state.reading);
  r.setAttribute("data-density", state.density);
  r.setAttribute("data-radius", state.radius);

  const ac = ACCENTS[state.accent] || ACCENTS.violet;
  r.style.setProperty("--accent", ac.a);
  r.style.setProperty("--accent-strong", ac.s);
  r.style.setProperty(
    "--accent-soft",
    `color-mix(in oklab, ${ac.a} 16%, var(--surface))`,
  );
  r.style.setProperty("--accent-soft-ink", ac.a);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.assign(state, DEFAULTS, saved);
  } catch {
    /* ignore malformed storage */
  }
}

function initAppearance() {
  if (initialized || !import.meta.client) return;
  initialized = true;
  loadState();
  applyToDom();
  watch(
    state,
    () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      applyToDom();
    },
    { deep: true },
  );
}

export function useAppearance() {
  initAppearance();

  const accentList = Object.keys(ACCENTS).map((k) => ({
    key: k,
    color: ACCENTS[k].a,
  }));
  const themeIcon = () =>
    state.theme === "dark"
      ? "moon"
      : state.theme === "light"
        ? "sun"
        : "monitor";
  const cycleTheme = () => {
    const order = ["system", "light", "dark"];
    state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
  };

  return { state, ACCENTS, accentList, themeIcon, cycleTheme, applyToDom };
}
