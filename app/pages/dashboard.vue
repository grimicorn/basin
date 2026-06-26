<script setup>
import { computed, ref } from "vue";

const PAGE_SIZE = 20;

const feedStore = useFeedStore();
const state = feedStore.state;

const appearanceStore = useAppearanceStore();

const { items: realFeeds, loading: feedsLoading, load: loadFeeds } = useFeeds();

const feedAdded = ref(false);
const isOnboarding = computed(
  () => !feedsLoading.value && realFeeds.value.length === 0 && !feedAdded.value,
);

onMounted(async () => {
  try {
    await loadFeeds();
    if (realFeeds.value.length > 0) {
      await feedStore.loadItems();
    }
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
  }
});

const showSkeleton = computed(
  () =>
    state.loading &&
    (appearanceStore.state.loadingStyle === "skeleton" ||
      appearanceStore.state.loadingStyle === "both"),
);
const staggerOn = computed(
  () =>
    appearanceStore.state.loadingStyle === "fade" ||
    appearanceStore.state.loadingStyle === "both",
);

// Infinite scroll: local windowing over the already-loaded visibleItems list.
// We never modify feed.ts — the store owns all items; we just slice here.
const visibleCount = ref(PAGE_SIZE);

// Reset window when the list identity changes (e.g. filter or unread toggle switches
// to a different set). Keying on length alone misses cases where a differently-filtered
// list happens to have the same count, so we use a stable ID signature instead.
// loadNextPage is synchronous (pure JS slice), so there is no async loading state to track.
watch(
  () => feedStore.visibleItems.map((item) => item.id).join(","),
  () => {
    visibleCount.value = PAGE_SIZE;
  },
);

const windowedItems = computed(() =>
  feedStore.visibleItems.slice(0, visibleCount.value),
);

const isEndOfFeed = computed(
  () =>
    !state.loading &&
    feedStore.visibleItems.length > 0 &&
    visibleCount.value >= feedStore.visibleItems.length,
);

function loadNextPage() {
  if (isEndOfFeed.value) {
    return;
  }
  const nextCount = visibleCount.value + PAGE_SIZE;
  visibleCount.value = Math.min(nextCount, feedStore.visibleItems.length);
}

const sentinelEl = ref(null);
useInfiniteScroll(sentinelEl, loadNextPage);
</script>

<template>
  <main class="wrap">
    <div class="subbar">
      <div class="subbar-top">
        <div>
          <h1 class="page-title">Your Feed</h1>
          <p v-if="isOnboarding" class="page-sub">
            <b style="color: var(--ink-2)">0</b>
            unread · no sources yet · let's change that
          </p>
          <p v-else class="page-sub">
            <b style="color: var(--ink-2)">{{ feedStore.unreadCount }}</b>
            unread across {{ realFeeds.length }} sources · updated just now
          </p>
        </div>
        <div class="subbar-tools">
          <button
            class="fchip"
            :class="{ active: state.unreadOnly }"
            :title="
              state.unreadOnly ? 'Showing unread only' : 'Show unread only'
            "
            @click="state.unreadOnly = !state.unreadOnly"
          >
            <span
              class="dot"
              :style="{
                '--c': state.unreadOnly ? 'var(--bg)' : 'var(--accent)',
              }"
            ></span
            >Unread only
          </button>
          <button class="btn btn-ghost" @click="feedStore.markAllRead">
            <RIcon name="checkAll" :size="16" /> Mark all read
          </button>
          <div class="seg">
            <button
              :class="{ active: state.layout === 'timeline' }"
              title="Timeline"
              @click="state.layout = 'timeline'"
            >
              <RIcon name="list" :size="16" />
            </button>
            <button
              :class="{ active: state.layout === 'grid' }"
              title="Grid"
              @click="state.layout = 'grid'"
            >
              <RIcon name="grid" :size="16" />
            </button>
            <button
              :class="{ active: state.layout === 'columns' }"
              title="Columns"
              @click="state.layout = 'columns'"
            >
              <RIcon name="columns" :size="16" />
            </button>
          </div>
        </div>
      </div>
      <div class="filters">
        <button
          v-for="fl in feedStore.filterDefs"
          :key="fl.id"
          class="fchip"
          :class="{ active: state.filter === fl.id }"
          @click="state.filter = fl.id"
        >
          <span class="dot" :style="{ '--c': fl.c }"></span>{{ fl.label
          }}<span class="count">{{ feedStore.countFor(fl.id) }}</span>
        </button>
      </div>
    </div>

    <!-- onboarding empty state -->
    <DashboardOnboarding v-if="isOnboarding" @feed-added="feedAdded = true" />

    <div v-else class="feed" :class="'layout-' + state.layout">
      <!-- skeleton -->
      <div v-if="showSkeleton" class="feed-grid">
        <SkeletonCard
          v-for="(k, i) in feedStore.skeletonKinds"
          :key="'sk' + i"
          :kind="k"
        />
      </div>

      <!-- loaded -->
      <template v-else>
        <div v-if="!feedStore.visibleItems.length" class="empty">
          <RIcon name="inbox" :size="40" />
          <h3>You're all caught up</h3>
          <p>
            Nothing left in this filter. Try another source or pull to refresh.
          </p>
        </div>

        <!-- timeline & grid -->
        <div
          v-else-if="state.layout !== 'columns'"
          class="feed-grid"
          :class="{ 'reveal-done': state.revealDone }"
        >
          <FeedItem
            v-for="(item, i) in windowedItems"
            :key="item.id"
            :item="item"
            :class="staggerOn ? 'stagger' : ''"
            :style="{ '--i': i }"
            @save="feedStore.toggleSave(item)"
            @open="feedStore.openItem(item)"
          />

          <!-- sentinel: triggers next page load when it scrolls into view -->
          <div
            v-if="!isEndOfFeed"
            ref="sentinelEl"
            class="feed-sentinel"
            aria-hidden="true"
          ></div>

          <div v-if="isEndOfFeed" class="feed-end" aria-live="polite">
            You've reached the end
          </div>
        </div>

        <!-- columns -->
        <div v-else class="feed-cols">
          <section v-for="d in feedStore.decks" :key="d.type" class="deck">
            <div class="deck-head">
              <span
                class="src-ic"
                :class="d.meta.cls"
                :style="{ '--c': 'var(--' + d.meta.cls + ')' }"
                ><RIcon :name="d.meta.icon" :size="14"
              /></span>
              <span class="deck-title">{{ d.meta.label }}</span>
              <span class="deck-count">{{ d.items.length }}</span>
            </div>
            <div class="deck-body" :class="{ 'reveal-done': state.revealDone }">
              <FeedItem
                v-for="(item, i) in d.items"
                :key="item.id"
                :item="item"
                :class="staggerOn ? 'stagger' : ''"
                :style="{ '--i': i }"
                @save="feedStore.toggleSave(item)"
                @open="feedStore.openItem(item)"
              />
            </div>
          </section>
        </div>
      </template>
    </div>
  </main>
</template>

<style>
/* ---------- Dashboard sub-bar ---------- */
.subbar {
  padding: 22px 0 6px;
}
.subbar-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}
.page-sub {
  font-size: 12px;
  color: var(--muted);
  margin: 5px 0 0;
}
.subbar-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* filter chips row */
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0 4px;
  flex-wrap: wrap;
}
.fchip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 13px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--ink-2);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s var(--ease);
  white-space: nowrap;
}
.fchip:hover {
  border-color: var(--accent);
  color: var(--ink);
}
.fchip.active {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}
.fchip .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--c, var(--accent));
}
.fchip .count {
  font-size: 10px;
  color: var(--faint);
}
.fchip.active .count {
  color: color-mix(in oklab, var(--bg) 70%, transparent);
}

.feed {
  padding: 18px 0 80px;
}

/* empty state */
.empty {
  text-align: center;
  padding: 80px 20px;
  color: var(--muted);
}
.empty .ricon {
  color: var(--faint);
  margin-bottom: 14px;
}
.empty h3 {
  font-size: 15px;
  color: var(--ink);
  margin: 0 0 6px;
}
.empty p {
  font-size: 12.5px;
  margin: 0;
}

/* infinite scroll sentinel and status */
.feed-sentinel {
  height: 1px;
}
.feed-end {
  text-align: center;
  padding: 24px 0;
  font-size: 12.5px;
  color: var(--muted);
}

/* ---------- Layout variants ---------- */
/* timeline — single column, comfortable reading width */
.layout-timeline .feed-grid {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  max-width: 660px;
  margin: 0 auto;
}

/* grid — masonry-ish via columns */
.layout-grid .feed-grid {
  columns: 3 280px;
  column-gap: var(--gap);
}
.layout-grid .feed-grid > * {
  break-inside: avoid;
  margin-bottom: var(--gap);
  display: block;
}

/* columns — per-source decks */
.layout-columns .feed-cols {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(280px, 1fr);
  gap: var(--gap);
  overflow-x: auto;
  padding-bottom: 16px;
}
.deck {
  min-width: 0;
}
.deck-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px 12px;
  position: sticky;
  top: 0;
}
.deck-head .src-ic {
  width: 24px;
  height: 24px;
}
.deck-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
}
.deck-count {
  font-size: 10px;
  color: var(--faint);
  margin-left: auto;
}
.deck-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (max-width: 720px) {
  .layout-grid .feed-grid {
    columns: 1;
  }
}
</style>
