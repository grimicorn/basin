<script setup>
// Pre-fetch the Clerk token during setup (before onMounted) so it is already
// in-flight or resolved by the time load() calls authHeaders(). Without this,
// the awaited getToken() inside authHeaders() can introduce a gap where no
// network request is in flight, causing Playwright's networkidle to fire
// before /api/feeds is requested.
const { getToken } = useAuth();
void getToken.value();

const { items, newUrl, loading, error, add, remove, load } = useFeeds();
onMounted(load);

function sourceColor(source) {
  return source === "podcast" ? "var(--src-podcast)" : "var(--src-rss)";
}
</script>

<template>
  <section class="set-section">
    <h2>RSS &amp; Podcasts</h2>
    <p class="desc">
      Paste any feed URL — Reader auto-detects whether it's an article feed or a
      podcast.
    </p>

    <p v-if="error" class="desc feed-error">{{ error }}</p>

    <div class="add-feed">
      <div class="field">
        <RIcon name="rss" :size="16" />
        <input
          v-model="newUrl"
          placeholder="https://example.com/feed.xml"
          :disabled="loading"
          @keyup.enter="add"
        />
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="loading"
        @click="add"
      >
        <RIcon name="plus" :size="16" /> Add feed
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
