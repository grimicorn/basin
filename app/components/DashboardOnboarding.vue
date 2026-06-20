<script setup>
const {
  newUrl,
  isAdding,
  discovering,
  error: feedError,
  add,
  load,
} = useFeeds();
onMounted(load);

const {
  items: connections,
  loading: connLoading,
  error: connError,
  connect,
  connectBluesky,
} = useConnections();

const emit = defineEmits(["feed-added"]);

const busy = computed(() => isAdding.value || discovering.value);

const blueskyHandle = ref("");
const blueskyPassword = ref("");
const showBlueskyForm = ref(false);

function iconForProvider(id) {
  if (id === "youtube") return "video";
  if (id === "bluesky") return "chat";
  return "link";
}

async function handleAdd() {
  await add();
  if (!feedError.value) {
    emit("feed-added");
  }
}

function handleConnect(id) {
  if (id === "bluesky") {
    showBlueskyForm.value = true;
    return;
  }
  connect(id);
}

async function submitBluesky() {
  await connectBluesky(blueskyHandle.value, blueskyPassword.value);
  if (!connError.value) {
    showBlueskyForm.value = false;
    blueskyHandle.value = "";
    blueskyPassword.value = "";
  }
}

function cancelBluesky() {
  showBlueskyForm.value = false;
  blueskyHandle.value = "";
  blueskyPassword.value = "";
}
</script>

<template>
  <div class="ob">
    <!-- hero -->
    <div class="ob-hero">
      <span class="ob-badge">
        <RIcon name="inbox" :size="34" />
      </span>
      <h1>Your feed is empty — let's fill it.</h1>
      <p>
        Connect your first source and Reader starts pulling new items into one
        quiet, chronological stream. Add a feed URL, or link an account.
      </p>
    </div>

    <!-- quick add RSS -->
    <div class="ob-card">
      <div class="ob-card-h">
        <span
          class="src-ic src-rss"
          style="--c: var(--src-rss); width: 26px; height: 26px"
        >
          <RIcon name="rss" :size="15" />
        </span>
        <span class="n">Start here</span>
        <span class="t">Add an RSS or podcast feed</span>
      </div>
      <p class="hint">
        Paste any feed URL — Reader auto-detects whether it's articles or a
        podcast.
      </p>
      <form class="ob-add" @submit.prevent="handleAdd">
        <InputText
          id="ob-feed-url"
          v-model="newUrl"
          placeholder="https://example.com or https://example.com/feed.xml"
          :error="feedError ?? undefined"
          :disabled="busy"
        >
          <template #icon>
            <RIcon name="rss" :size="16" />
          </template>
        </InputText>
        <button type="submit" class="btn btn-primary ob-add-btn" :disabled="busy">
          <RIcon name="plus" :size="16" />
          {{ busy ? "Adding…" : "Add feed" }}
        </button>
      </form>
    </div>

    <div class="ob-or">or connect an account</div>

    <p v-if="connError" class="conn-error">{{ connError }}</p>

    <!-- connect accounts -->
    <div class="ob-grid">
      <div
        v-for="conn in connections"
        :key="conn.id"
        class="ob-src"
        :class="{ 'ob-src-expanded': conn.id === 'bluesky' && showBlueskyForm }"
      >
        <div class="ob-src-row">
          <span class="conn-ic" :style="{ '--c': conn.color }">
            <RIcon :name="iconForProvider(conn.id)" :size="20" />
          </span>
          <div class="info">
            <div class="nm">{{ conn.name }}</div>
            <div class="ds">{{ conn.desc }}</div>
          </div>
          <button
            class="btn connect"
            :class="{ 'btn-primary': !conn.connected }"
            :disabled="connLoading || conn.connected"
            @click="handleConnect(conn.id)"
          >
            {{ conn.connected ? "Connected" : "Connect" }}
          </button>
        </div>

        <!-- Bluesky inline form -->
        <div
          v-if="conn.id === 'bluesky' && showBlueskyForm"
          class="bluesky-form"
        >
          <p class="hint">
            Enter your Bluesky handle and an App Password from
            <a href="https://bsky.app/settings/app-passwords" target="_blank">
              bsky.app/settings/app-passwords</a
            >.
          </p>
          <InputText
            id="ob-bsky-handle"
            v-model="blueskyHandle"
            label="Handle"
            placeholder="you or you.bsky.social"
            :disabled="connLoading"
          />
          <InputText
            id="ob-bsky-password"
            v-model="blueskyPassword"
            label="App Password"
            type="password"
            placeholder="xxxx-xxxx-xxxx-xxxx"
            :disabled="connLoading"
          />
          <div class="bluesky-actions">
            <button
              class="btn btn-primary"
              :disabled="connLoading || !blueskyHandle || !blueskyPassword"
              @click="submitBluesky"
            >
              Connect
            </button>
            <button class="btn" :disabled="connLoading" @click="cancelBluesky">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- getting-started steps -->
    <div class="ob-steps">
      <span class="ob-step active">
        <span class="ix">1</span>Add a source
      </span>
      <span class="ob-step">
        <span class="ix">2</span>Pick a layout
      </span>
      <span class="ob-step">
        <span class="ix">3</span>Make it yours
      </span>
    </div>
  </div>
</template>

<style scoped>
.ob {
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 0 100px;
}

.ob-hero {
  text-align: center;
  padding: 28px 0 4px;
}

.ob-badge {
  width: 70px;
  height: 70px;
  margin: 0 auto 22px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid color-mix(in oklab, var(--accent) 22%, transparent);
}

.ob-hero h1 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--ink);
  text-wrap: balance;
}

.ob-hero p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
  margin: 10px auto 0;
  max-width: 440px;
  text-wrap: pretty;
}

.ob-add {
  display: flex;
  gap: 10px;
  margin: 16px 0 0;
  align-items: flex-start;
}

.ob-add :deep(.fgroup) {
  flex: 1;
}

.ob-add-btn {
  flex-shrink: 0;
  height: 44px;
  align-self: flex-end;
}

.ob-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 22px;
  margin-top: 22px;
}

.ob-card-h {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.ob-card-h .n {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
}

.ob-card-h .t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
}

.ob-card .hint {
  font-size: 11.5px;
  color: var(--muted);
  margin: 0 0 0;
}

.ob-or {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--faint);
  font-size: 11px;
  margin: 24px 0;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ob-or::before,
.ob-or::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.conn-error {
  font-size: 12px;
  color: var(--danger);
  margin: 0 0 12px;
}

.ob-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ob-src {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  transition: border-color 0.16s var(--ease);
}

.ob-src:hover {
  border-color: var(--border-strong);
}

.ob-src-expanded {
  grid-column: 1 / -1;
}

.ob-src-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ob-src .conn-ic {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  flex-shrink: 0;
}

.ob-src .info {
  flex: 1;
  min-width: 0;
}

.ob-src .nm {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
}

.ob-src .ds {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}

.bluesky-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--border);
}

.bluesky-form .hint {
  font-size: 11.5px;
  color: var(--muted);
  margin: 0;
}

.bluesky-actions {
  display: flex;
  gap: 8px;
}

.ob-steps {
  display: flex;
  gap: 10px;
  margin: 30px 0 0;
  flex-wrap: wrap;
  justify-content: center;
}

.ob-step {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 11.5px;
  color: var(--muted);
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.ob-step .ix {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 600;
  background: var(--surface-2);
  color: var(--muted);
  border: 1px solid var(--border-strong);
}

.ob-step.active {
  border-color: var(--accent);
  color: var(--ink);
}

.ob-step.active .ix {
  background: var(--accent);
  color: var(--accent-on);
  border-color: var(--accent);
}

@media (max-width: 560px) {
  .ob-grid {
    grid-template-columns: 1fr;
  }

  .ob-src-expanded {
    grid-column: auto;
  }

  .ob-add {
    flex-direction: column;
  }

  .ob-add-btn {
    width: 100%;
  }
}
</style>
