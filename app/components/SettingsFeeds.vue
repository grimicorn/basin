<script setup>
const {
  items,
  newUrl,
  loading,
  isAdding,
  discovering,
  error,
  add,
  remove,
  load,
} = useFeeds();
onMounted(load);

const busy = computed(() => isAdding.value || discovering.value);
const buttonLabel = computed(() => {
  if (discovering.value) return "Finding feed…";
  if (isAdding.value) return "Adding…";
  return "Add feed";
});

function sourceColor(source) {
  return source === "podcast" ? "var(--src-podcast)" : "var(--src-rss)";
}
</script>

<template>
  <section class="set-section">
    <h2>RSS &amp; Podcasts</h2>
    <p class="desc">
      Paste a feed URL or a plain website address — Reader will find the feed
      automatically.
    </p>

    <p v-if="error" class="desc feed-error">{{ error }}</p>

    <div class="add-feed">
      <div class="field">
        <RIcon name="rss" :size="16" />
        <input
          v-model="newUrl"
          placeholder="https://example.com or https://example.com/feed.xml"
          :disabled="busy"
          @keyup.enter="add"
        />
      </div>
      <button class="btn btn-primary" :disabled="busy" @click="add">
        <RIcon name="plus" :size="16" /> {{ buttonLabel }}
      </button>
    </div>

    <div class="feed-list">
      <div v-for="fd in items" :key="fd.id" class="feed-row">
        <span class="feed-ic" :style="{ '--c': sourceColor(fd.source) }">
          <RIcon :name="fd.source === 'podcast' ? 'mic' : 'rss'" :size="16" />
        </span>
        <div class="feed-info">
          <div class="feed-name">{{ fd.title ?? fd.url }}</div>
          <div class="feed-url">{{ fd.url }}</div>
        </div>
        <button class="icon-btn" title="Remove" @click="remove(fd.id)">
          <RIcon name="trash" :size="16" />
        </button>
      </div>
      <p v-if="loading && !items.length" class="desc">Loading…</p>
      <p v-else-if="!items.length" class="desc">No feeds added yet.</p>
    </div>
  </section>
</template>
