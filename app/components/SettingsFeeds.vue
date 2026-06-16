<script setup>
const {
  items,
  newUrl,
  loading,
  isAdding,
  discovering,
  error,
  pendingFeed,
  add,
  confirmAdd,
  cancelAdd,
  setSourceOverride,
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

const effectiveSource = computed(() => {
  if (!pendingFeed.value) return null;
  return pendingFeed.value.sourceOverride ?? pendingFeed.value.detectedSource;
});

function sourceColor(source) {
  return source === "podcast" ? "var(--src-podcast)" : "var(--src-rss)";
}

function onSourceOverrideChange(event) {
  const value = event.target.value;
  setSourceOverride(value === pendingFeed.value?.detectedSource ? null : value);
}

function trimUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return url;
  }
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

    <div v-if="pendingFeed" class="pending-feed my-6">
      <p class="desc pending-feed-url text-muted mb-2 truncate">
        {{ pendingFeed.url }}
      </p>
      <div class="flex items-center">
        <div class="pending-feed-override mr-6">
          <label for="pending-feed-type" class="pending-feed-override-label">
            Detected:
          </label>
          <select
            id="pending-feed-type"
            :value="effectiveSource"
            class="pending-feed-select"
            @change="onSourceOverrideChange"
          >
            <option value="rss">RSS Feed</option>
            <option value="podcast">Podcast</option>
          </select>
        </div>
        <div class="pending-feed-actions -mx-2">
          <button
            class="btn btn-primary mx-2"
            :disabled="isAdding"
            @click="confirmAdd"
          >
            {{ isAdding ? "Adding…" : "Confirm" }}
          </button>
          <button class="btn mx-2" :disabled="isAdding" @click="cancelAdd">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div v-else class="add-feed">
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
          <div class="feed-name truncate">
            {{ fd.title ?? trimUrl(fd.url) }}
          </div>
          <div class="feed-url truncate">{{ fd.url }}</div>
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
