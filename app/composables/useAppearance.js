/* useAppearance — theme + visual tweaks, persisted to the database and
   applied to <html> via data-* attributes and CSS custom properties.
   Singleton: every component shares one reactive instance. */
import { reactive, ref, watch } from "vue";

export const ACCENTS = {
  violet: { a: "oklch(0.6 0.17 285)", s: "oklch(0.54 0.18 285)" },
  blue: { a: "oklch(0.62 0.15 245)", s: "oklch(0.56 0.16 245)" },
  teal: { a: "oklch(0.64 0.11 195)", s: "oklch(0.58 0.12 195)" },
  amber: { a: "oklch(0.71 0.13 72)", s: "oklch(0.65 0.14 72)" },
  rose: { a: "oklch(0.63 0.18 14)", s: "oklch(0.57 0.19 14)" },
};

const DEFAULTS = {
  theme: "system", // system | light | dark
  accent: "violet", // key of ACCENTS
  reading: "mono", // mono | serif
  density: "cozy", // compact | cozy | roomy
  radius: "sharp", // sharp | default | round
  loadingStyle: "both", // skeleton | fade | both
};

const state = reactive({ ...DEFAULTS });
const ready = ref(false);
let initialized = false;

function applyToDom() {
  if (!import.meta.client) return;
  const root = document.documentElement;

  if (state.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", state.theme);

  root.setAttribute("data-reading", state.reading);
  root.setAttribute("data-density", state.density);
  root.setAttribute("data-radius", state.radius);

  const accentColors = ACCENTS[state.accent] || ACCENTS.violet;
  root.style.setProperty("--accent", accentColors.a);
  root.style.setProperty("--accent-strong", accentColors.s);
  root.style.setProperty(
    "--accent-soft",
    `color-mix(in oklab, ${accentColors.a} 16%, var(--surface))`,
  );
  root.style.setProperty("--accent-soft-ink", accentColors.a);
}

function applyDbSettings(dbSettings) {
  state.theme = dbSettings.theme ?? DEFAULTS.theme;
  state.accent = dbSettings.accentColor ?? DEFAULTS.accent;
  state.reading = dbSettings.readingFont ?? DEFAULTS.reading;
  state.density = dbSettings.spacing ?? DEFAULTS.density;
  state.radius = dbSettings.radius ?? DEFAULTS.radius;
}

function buildPatch(changedState) {
  return {
    theme: changedState.theme,
    accentColor: changedState.accent,
    readingFont: changedState.reading,
    spacing: changedState.density,
    radius: changedState.radius,
  };
}

async function initAppearance() {
  if (initialized || !import.meta.client) return;
  initialized = true;

  const { load, save } = useUserSettings();
  const dbSettings = await load();
  applyDbSettings(dbSettings);
  applyToDom();
  ready.value = true;

  watch(
    state,
    (changedState) => {
      applyToDom();
      save(buildPatch(changedState));
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

  return { state, ready, ACCENTS, accentList, themeIcon, cycleTheme, applyToDom };
}
