<script setup>
const { items, loading, error, load, connect, connectBluesky, disconnect } =
  useConnections();
onMounted(load);

const blueskyHandle = ref("");
const blueskyAppPassword = ref("");
const showBlueskyForm = ref(false);

function iconForProvider(id) {
  if (id === "youtube") return "video";
  if (id === "bluesky") return "chat";
  return "link";
}

function toggleConn(connection) {
  if (connection.connected) {
    disconnect(connection.id);
    return;
  }
  if (connection.id === "bluesky") {
    showBlueskyForm.value = true;
    return;
  }
  connect(connection.id);
}

async function submitBlueskyForm() {
  try {
    await connectBluesky(blueskyHandle.value, blueskyAppPassword.value);
    showBlueskyForm.value = false;
    blueskyHandle.value = "";
    blueskyAppPassword.value = "";
  } catch {
    // error is already set on the composable
  }
}

function cancelBlueskyForm() {
  showBlueskyForm.value = false;
  blueskyHandle.value = "";
  blueskyAppPassword.value = "";
}

const formatter = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});
</script>

<template>
  <section class="set-section">
    <h2>Connected accounts</h2>
    <p class="desc">
      Link {{ formatter.format(items.map(({ name }) => name)) }} to fold their
      timelines into your feed.
    </p>
    <p v-if="error" class="desc conn-error">{{ error }}</p>
    <div class="conn-grid">
      <div
        v-for="connection in items"
        :key="connection.id"
        class="conn"
        :class="{
          'conn-expanded': connection.id === 'bluesky' && showBlueskyForm,
        }"
      >
        <div class="conn-row">
          <span class="conn-ic" :style="{ '--c': connection.color }">
            <RIcon :name="iconForProvider(connection.id)" :size="22" />
          </span>
          <div class="conn-info">
            <div class="conn-name">
              {{ connection.name }}
              <span v-if="connection.connected" class="live"></span>
            </div>
            <div class="conn-desc">{{ connection.desc }}</div>
            <div
              v-if="
                connection.connected && (connection.account || connection.since)
              "
              class="conn-since"
            >
              {{
                [connection.account, connection.since]
                  .filter(Boolean)
                  .join(" · ")
              }}
            </div>
          </div>
          <button
            class="btn"
            :class="{ 'btn-primary': !connection.connected }"
            :disabled="loading"
            @click="toggleConn(connection)"
          >
            {{ connection.connected ? "Disconnect" : "Connect" }}
          </button>
        </div>
        <div
          v-if="connection.id === 'bluesky' && showBlueskyForm"
          class="bluesky-form"
        >
          <p class="desc">
            Enter your Bluesky handle and an App Password from
            <a href="https://bsky.app/settings/app-passwords" target="_blank"
              >bsky.app/settings/app-passwords</a
            >.
          </p>
          <InputText
            id="bluesky-handle"
            v-model="blueskyHandle"
            label="Handle"
            placeholder="you or you.bsky.social"
            :disabled="loading"
          />
          <InputText
            id="bluesky-app-password"
            v-model="blueskyAppPassword"
            label="App Password"
            type="password"
            placeholder="xxxx-xxxx-xxxx-xxxx"
            :disabled="loading"
          />
          <div class="bluesky-actions">
            <button
              class="btn btn-primary"
              :disabled="loading || !blueskyHandle || !blueskyAppPassword"
              @click="submitBlueskyForm"
            >
              Connect
            </button>
            <button class="btn" :disabled="loading" @click="cancelBlueskyForm">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.conn-expanded {
  flex-direction: column;
  align-items: stretch;
}

.conn-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.bluesky-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.bluesky-actions {
  display: flex;
  gap: 8px;
}
</style>
