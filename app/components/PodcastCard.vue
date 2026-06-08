<script setup>
const props = defineProps({ item: { type: Object, required: true } });
defineEmits(["save", "open"]);

const pct = () => Math.round((props.item.progress || 0) * 100);
</script>

<template>
  <article class="card card-podcast">
    <div class="pod-top" @click="$emit('open')">
      <div class="pod-cover ph ratio-1x1" data-label="cover">
        <RIcon name="mic" :size="20" />
      </div>
      <div class="pod-main">
        <div class="card-head">
          <SourceTag :item="item" />
          <CardActions
            :item="item"
            @save="$emit('save')"
            @open="$emit('open')"
          />
        </div>
        <h3 class="card-title">{{ item.title }}</h3>
        <p class="card-excerpt sm">{{ item.excerpt }}</p>
      </div>
    </div>
    <div class="pod-player">
      <button class="pod-play" title="Play episode" @click.stop>
        <RIcon name="play" :size="15" />
      </button>
      <div class="pod-bar"><i :style="{ width: pct() + '%' }"></i></div>
      <span class="pod-dur"
        >{{ item.progress ? pct() + "% · " : "" }}{{ item.meta }}</span
      >
    </div>
  </article>
</template>

<style>
.pod-top {
  display: flex;
  gap: 14px;
}
.pod-cover {
  width: 76px;
  height: 76px;
  flex: none;
  color: var(--src-podcast);
}
.pod-main {
  min-width: 0;
  flex: 1;
}
.pod-player {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.pod-play {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 50%;
  border: 0;
  cursor: pointer;
  background: var(--src-podcast);
  color: #fff;
  display: grid;
  place-items: center;
  transition: transform 0.15s var(--ease);
}
.pod-play:hover {
  transform: scale(1.08);
}
.pod-bar {
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}
.pod-bar i {
  display: block;
  height: 100%;
  background: var(--src-podcast);
  border-radius: 999px;
}
.pod-dur {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
</style>
