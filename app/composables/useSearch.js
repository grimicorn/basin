/* useSearch — command-palette state (open, query, keyboard cursor).
   Result grouping lives in SearchOverlay.vue since it needs the router. */
import { reactive, nextTick } from "vue";

const state = reactive({ open: false, query: "", cursor: 0 });

export function useSearch() {
  function openSearch() {
    state.open = true;
    state.query = "";
    state.cursor = 0;
    nextTick(() => {
      if (import.meta.client)
        document.getElementById("reader-search-input")?.focus();
    });
  }
  function closeSearch() {
    state.open = false;
  }
  function moveCursor(d, total) {
    if (!total) return;
    state.cursor = (state.cursor + d + total) % total;
  }
  return { state, openSearch, closeSearch, moveCursor };
}
