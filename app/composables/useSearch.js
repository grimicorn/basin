/* useSearch — command-palette state (open, query, keyboard cursor).
   Result grouping lives in SearchOverlay.vue since it needs the router. */
import { reactive, nextTick } from "vue";

const state = reactive({
  open: false,
  query: "",
  cursor: 0,
  results: [],
  searching: false,
});

export function useSearch() {
  function openSearch() {
    state.open = true;
    state.query = "";
    state.cursor = 0;
    state.results = [];
    nextTick(() => {
      if (import.meta.client)
        document.getElementById("reader-search-input")?.focus();
    });
  }

  function closeSearch() {
    state.open = false;
  }

  function moveCursor(delta, total) {
    if (!total) return;
    state.cursor = (state.cursor + delta + total) % total;
  }

  async function runSearch(query) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      state.results = [];
      return;
    }

    state.searching = true;
    try {
      const hits = await $fetch("/api/search", {
        query: { q: trimmedQuery },
      });
      state.results = hits;
    } catch {
      state.results = [];
    } finally {
      state.searching = false;
    }
  }

  return { state, openSearch, closeSearch, moveCursor, runSearch };
}
