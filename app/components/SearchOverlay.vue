<script setup>
import { computed, watch, onMounted, onUnmounted } from "vue";
import { SOURCES } from "~/lib/icons";

const { state, closeSearch, moveCursor } = useSearch();
const { state: feed, openItem } = useFeed();

const PAGES = [
  { kind: "page", id: "/", title: "Dashboard", sub: "Your unified feed" },
  {
    kind: "page",
    id: "/settings",
    title: "Settings",
    sub: "Feeds & connected accounts",
  },
  { kind: "page", id: "/login", title: "Sign in", sub: "Account & session" },
];

const pageMatchesQuery = (p, q) =>
  !q || p.title.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q);

const itemHaystack = (i) =>
  [i.title, i.text, i.caption, i.source, i.excerpt, (i.tags || []).join(" ")]
    .join(" ")
    .toLowerCase();

const matchingItems = (items, q) =>
  items
    .filter((i) => !q || itemHaystack(i).includes(q))
    .slice(0, q ? 20 : 6)
    .map((ref) => ({ kind: "item", ref }));

const searchGroups = computed(() => {
  const q = state.query.trim().toLowerCase();
  const pages = PAGES.filter((p) => pageMatchesQuery(p, q));
  const items = matchingItems(feed.items, q);
  const groups = [];
  if (pages.length) groups.push({ label: "Pages", rows: pages });
  if (items.length)
    groups.push({ label: q ? "Results" : "Recent", rows: items });
  return groups;
});
const searchFlat = computed(() => searchGroups.value.flatMap((g) => g.rows));

const srcVar = (type) => `var(--${SOURCES[type].cls})`;
const srcLabel = (type) => SOURCES[type].label;

function chooseRow(row) {
  if (row.kind === "page") navigateTo(row.id);
  else openItem(row.ref);
  closeSearch();
}
function chooseCursor() {
  const row = searchFlat.value[state.cursor];
  if (row) chooseRow(row);
}

function onKey(e) {
  if (!state.open) return;
  const n = searchFlat.value.length;
  const dispatch = {
    Escape: () => closeSearch(),
    ArrowDown: () => {
      e.preventDefault();
      moveCursor(1, n);
    },
    ArrowUp: () => {
      e.preventDefault();
      moveCursor(-1, n);
    },
    Enter: () => {
      e.preventDefault();
      chooseCursor();
    },
  };
  dispatch[e.key]?.();
}

watch(
  () => state.query,
  () => {
    state.cursor = 0;
  },
);
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div v-if="state.open" class="search-scrim" @click.self="closeSearch">
    <div class="search-modal">
      <div class="search-in">
        <RIcon name="search" :size="22" />
        <input
          id="reader-search-input"
          v-model="state.query"
          placeholder="search posts, podcasts, videos, pages…"
        />
        <span class="kbd">esc</span>
        <button class="icon-btn" @click="closeSearch">
          <RIcon name="x" :size="18" />
        </button>
      </div>

      <div class="search-results">
        <template v-for="g in searchGroups" :key="g.label">
          <div class="sr-group">{{ g.label }}</div>
          <div
            v-for="row in g.rows"
            :key="row.kind === 'page' ? row.id : 'i' + row.ref.id"
            class="sr-item"
            :class="{ cursor: searchFlat.indexOf(row) === state.cursor }"
            @mouseenter="state.cursor = searchFlat.indexOf(row)"
            @click="chooseRow(row)"
          >
            <template v-if="row.kind === 'page'">
              <span class="sr-pill" style="--c: var(--accent-soft-ink)"
                >PAGE</span
              >
              <div class="sr-main">
                <div class="sr-title">{{ row.title }}</div>
                <div class="sr-sub">{{ row.sub }}</div>
              </div>
            </template>
            <template v-else>
              <span class="sr-pill" :style="{ '--c': srcVar(row.ref.type) }">{{
                srcLabel(row.ref.type)
              }}</span>
              <div class="sr-main">
                <div class="sr-title">
                  {{ row.ref.title || row.ref.text || row.ref.caption }}
                </div>
                <div class="sr-sub">
                  {{ row.ref.source }} · {{ row.ref.meta || row.ref.time }}
                </div>
              </div>
            </template>
            <span class="sr-arrow"><RIcon name="arrowRight" :size="16" /></span>
          </div>
        </template>

        <div v-if="!searchFlat.length" class="empty" style="padding: 48px 20px">
          <h3>No matches</h3>
          <p>Try a different word, source, or tag.</p>
        </div>
      </div>

      <div class="search-foot">
        <span class="hint"><span class="kbd">↑↓</span> navigate</span>
        <span class="hint"><span class="kbd">↵</span> open</span>
        <span class="hint"><span class="kbd">esc</span> close</span>
      </div>
    </div>
  </div>
</template>

<style>
.search-scrim {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: color-mix(in oklab, var(--bg) 40%, #00000055);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.search-modal {
  width: min(760px, calc(100vw - 32px));
  margin-top: 11vh;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: popSafe 0.22s var(--ease);
}
.search-in {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 18px;
  border-bottom: 1px solid var(--border);
}
.search-in .ricon {
  color: var(--muted);
  flex: none;
}
.search-in input {
  flex: 1;
  border: 0;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  font-size: 18px;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.search-in input::placeholder {
  color: var(--faint);
}
.search-results {
  max-height: 56vh;
  overflow-y: auto;
  padding: 8px;
}
.sr-group {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
  padding: 12px 12px 6px;
}
.sr-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 12px;
  border-radius: 10px;
  cursor: pointer;
}
.sr-item:hover,
.sr-item.cursor {
  background: var(--surface-2);
}
.sr-pill {
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 4px 7px;
  border-radius: 6px;
  background: color-mix(in oklab, var(--c, var(--accent)) 15%, transparent);
  color: var(--c, var(--accent-soft-ink));
  flex: none;
  min-width: 58px;
  text-align: center;
}
.sr-main {
  min-width: 0;
  flex: 1;
}
.sr-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-sub {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-arrow {
  color: var(--faint);
  flex: none;
}
.search-foot {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 11px 18px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--muted);
}
.search-foot .hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
