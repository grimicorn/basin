import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSearch } from "~/composables/useSearch";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

const { state, openSearch, closeSearch, moveCursor, runSearch } = useSearch();

describe("useSearch", () => {
  beforeEach(() => {
    state.open = false;
    state.query = "";
    state.cursor = 0;
    state.results = [];
    state.searching = false;
    vi.resetAllMocks();
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

    it("clears previous results", () => {
      state.results = [{ objectID: "feed_item_1", title: "Old" }];
      openSearch();
      expect(state.results).toEqual([]);
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

  describe("runSearch", () => {
    it("sets results from the API response", async () => {
      const hits = [{ objectID: "feed_item_1", title: "Result" }];
      mockFetch.mockResolvedValue(hits);
      await runSearch("test");
      expect(state.results).toEqual(hits);
    });

    it("calls the search API with the trimmed query", async () => {
      mockFetch.mockResolvedValue([]);
      await runSearch("  hello  ");
      expect(mockFetch).toHaveBeenCalledWith("/api/search", {
        query: { q: "hello" },
      });
    });

    it("skips the API call and clears results when query is empty", async () => {
      state.results = [{ objectID: "feed_item_1", title: "Old" }];
      await runSearch("");
      expect(mockFetch).not.toHaveBeenCalled();
      expect(state.results).toEqual([]);
    });

    it("clears results on API failure", async () => {
      state.results = [{ objectID: "feed_item_1", title: "Old" }];
      mockFetch.mockRejectedValue(new Error("Network error"));
      await runSearch("test");
      expect(state.results).toEqual([]);
    });

    it("sets searching to false after a successful response", async () => {
      mockFetch.mockResolvedValue([]);
      await runSearch("test");
      expect(state.searching).toBe(false);
    });

    it("sets searching to false after a failed response", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      await runSearch("test");
      expect(state.searching).toBe(false);
    });
  });
});
