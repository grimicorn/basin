<script setup>
const { items, loading, error, load, connect, disconnect } = useConnections();
onMounted(load);

function toggleConn(c) {
  if (c.connected) disconnect(c.id);
  else connect(c.id);
}
</script>

<template>
  <section class="set-section">
    <h2>Connected accounts</h2>
    <p class="desc">
      Link YouTube, X, and Instagram to fold their timelines into your feed.
    </p>
    <p v-if="error" class="desc conn-error">{{ error }}</p>
    <div class="conn-grid">
      <div v-for="c in items" :key="c.id" class="conn">
        <span class="conn-ic" :style="{ '--c': c.color }">
          <RIcon
            :name="
              c.id === 'youtube'
                ? 'video'
                : c.id === 'twitter'
                  ? 'chat'
                  : 'photo'
            "
            :size="22"
          />
        </span>
        <div class="conn-info">
          <div class="conn-name">
            {{ c.name }} <span v-if="c.connected" class="live"></span>
          </div>
          <div class="conn-desc">{{ c.desc }}</div>
          <div v-if="c.connected && (c.account || c.since)" class="conn-since">
            {{ [c.account, c.since].filter(Boolean).join(" · ") }}
          </div>
        </div>
        <button
          class="btn"
          :class="{ 'btn-primary': !c.connected }"
          :disabled="loading"
          @click="toggleConn(c)"
        >
          {{ c.connected ? "Disconnect" : "Connect" }}
        </button>
      </div>
    </div>
  </section>
</template>
