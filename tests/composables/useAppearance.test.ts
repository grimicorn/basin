import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAppearanceStore, ACCENTS } from "~/stores/appearance";

describe("useAppearanceStore", () => {
  let store: ReturnType<typeof useAppearanceStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useAppearanceStore();
    // Reset to predictable defaults before each test
    store.state.theme = "system";
    store.state.accent = "violet";
    store.state.reading = "mono";
    store.state.density = "cozy";
    store.state.radius = "sharp";
  });

  describe("themeIcon", () => {
    it("returns monitor for system theme", () => {
      store.state.theme = "system";
      expect(store.themeIcon).toBe("monitor");
    });

    it("returns moon for dark theme", () => {
      store.state.theme = "dark";
      expect(store.themeIcon).toBe("moon");
    });

    it("returns sun for light theme", () => {
      store.state.theme = "light";
      expect(store.themeIcon).toBe("sun");
    });
  });

  describe("cycleTheme", () => {
    it("cycles system → light", () => {
      store.state.theme = "system";
      store.cycleTheme();
      expect(store.state.theme).toBe("light");
    });

    it("cycles light → dark", () => {
      store.state.theme = "light";
      store.cycleTheme();
      expect(store.state.theme).toBe("dark");
    });

    it("cycles dark → system", () => {
      store.state.theme = "dark";
      store.cycleTheme();
      expect(store.state.theme).toBe("system");
    });
  });

  describe("accentList", () => {
    it("includes all ACCENTS keys", () => {
      expect(store.accentList.map((a) => a.key)).toEqual(Object.keys(ACCENTS));
    });

    it("includes the oklch color value for each accent", () => {
      store.accentList.forEach((a) => {
        expect(a.color).toBe(ACCENTS[a.key as keyof typeof ACCENTS].a);
      });
    });
  });

  describe("applyToDom", () => {
    it("does not throw when called", () => {
      expect(() => store.applyToDom()).not.toThrow();
    });
  });
});
