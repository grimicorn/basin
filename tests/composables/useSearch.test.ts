import { describe, it, expect, beforeEach } from "vitest";
import { useSearch } from "~/composables/useSearch";

const { state, openSearch, closeSearch, moveCursor } = useSearch();

describe("useSearch", () => {
  beforeEach(() => {
    state.open = false;
    state.query = "";
    state.cursor = 0;
  });

  describe("openSearch", () => {
    it("opens the overlay", () => {
      openSearch();
      expect(state.open).toBe(true);
    });

    it("resets query and cursor", () => {
      state.query = "old query";
      state.cursor = 3;
      openSearch();
      expect(state.query).toBe("");
      expect(state.cursor).toBe(0);
    });
  });

  describe("closeSearch", () => {
    it("closes the overlay", () => {
      state.open = true;
      closeSearch();
      expect(state.open).toBe(false);
    });
  });

  describe("moveCursor", () => {
    it("advances cursor forward", () => {
      state.cursor = 0;
      moveCursor(1, 3);
      expect(state.cursor).toBe(1);
    });

    it("wraps at end", () => {
      state.cursor = 2;
      moveCursor(1, 3);
      expect(state.cursor).toBe(0);
    });

    it("moves backward", () => {
      state.cursor = 1;
      moveCursor(-1, 3);
      expect(state.cursor).toBe(0);
    });

    it("wraps backward from 0", () => {
      state.cursor = 0;
      moveCursor(-1, 3);
      expect(state.cursor).toBe(2);
    });

    it("does nothing with total=0", () => {
      state.cursor = 2;
      moveCursor(1, 0);
      expect(state.cursor).toBe(2);
    });
  });
});
