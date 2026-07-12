<script setup>
import { computed, ref } from "vue";

const PAGE_SIZE = 20;

defineProps({
  stagger: {
    type: Boolean,
    default: false,
  },
});

const feedStore = useFeedStore();
const state = feedStore.state;

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
  <div class="feed-grid" :class="{ 'reveal-done': state.revealDone }">
    <FeedItem
      v-for="(item, i) in windowedItems"
      :key="item.id"
      :item="item"
      :class="stagger ? 'stagger' : ''"
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
</template>
