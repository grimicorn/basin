<script setup>
defineProps({
  isOnboarding: {
    type: Boolean,
    default: false,
  },
  sourceCount: {
    type: Number,
    default: 0,
  },
});

const feedStore = useFeedStore();
const state = feedStore.state;
</script>

<template>
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
          unread across {{ sourceCount }} sources · updated just now
        </p>
      </div>
      <div class="subbar-tools">
        <button
          class="fchip"
          :class="{ active: state.unreadOnly }"
          :title="state.unreadOnly ? 'Showing unread only' : 'Show unread only'"
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
</style>
