import { describe, it, expect, beforeEach } from "vitest";
import { useAppearance, ACCENTS } from "~/composables/useAppearance";

describe("useAppearance", () => {
  let result: ReturnType<typeof useAppearance>;

  beforeEach(() => {
    result = useAppearance();
    // Reset to predictable defaults before each test
    result.state.theme = "system";
    result.state.accent = "violet";
    result.state.reading = "mono";
    result.state.density = "cozy";
    result.state.radius = "sharp";
  });

  describe("themeIcon", () => {
    it("returns monitor for system theme", () => {
      result.state.theme = "system";
      expect(result.themeIcon()).toBe("monitor");
    });

    it("returns moon for dark theme", () => {
      result.state.theme = "dark";
      expect(result.themeIcon()).toBe("moon");
    });

    it("returns sun for light theme", () => {
      result.state.theme = "light";
      expect(result.themeIcon()).toBe("sun");
    });
  });

  describe("cycleTheme", () => {
    it("cycles system → light", () => {
      result.state.theme = "system";
      result.cycleTheme();
      expect(result.state.theme).toBe("light");
    });

    it("cycles light → dark", () => {
      result.state.theme = "light";
      result.cycleTheme();
      expect(result.state.theme).toBe("dark");
    });

    it("cycles dark → system", () => {
      result.state.theme = "dark";
      result.cycleTheme();
      expect(result.state.theme).toBe("system");
    });
  });

  describe("accentList", () => {
    it("includes all ACCENTS keys", () => {
      expect(result.accentList.map((a) => a.key)).toEqual(Object.keys(ACCENTS));
    });

    it("includes the oklch color value for each accent", () => {
      result.accentList.forEach((a) => {
        expect(a.color).toBe(ACCENTS[a.key as keyof typeof ACCENTS].a);
      });
    });
  });

  describe("applyToDom", () => {
    it("does not throw when called", () => {
      expect(() => result.applyToDom()).not.toThrow();
    });
  });
});
