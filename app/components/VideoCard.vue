<script setup>
defineProps({ item: { type: Object, required: true } });
defineEmits(["save", "open"]);
</script>

<template>
  <article class="card card-video" @click="$emit('open')">
    <div class="thumb ph ratio-16x9" :data-label="item.thumb">
      <span class="thumb-play"><RIcon name="play" :size="22" /></span>
      <span class="thumb-dur">{{ item.meta }}</span>
    </div>
    <div class="card-body">
      <div class="card-head">
        <SourceTag :item="item" />
        <CardActions :item="item" @save="$emit('save')" @open="$emit('open')" />
      </div>
      <h3 class="card-title">{{ item.title }}</h3>
      <span class="card-meta">{{ item.views }}</span>
    </div>
  </article>
</template>

<style>
.card-video {
  padding: 0;
}
.card-video .card-body {
  padding: 14px var(--card-pad) var(--card-pad);
}
.card-video .thumb {
  border-radius: 0;
}
.thumb {
  width: 100%;
  position: relative;
}
.ratio-16x9 {
  aspect-ratio: 16/9;
}
.ratio-1x1 {
  aspect-ratio: 1/1;
}
.thumb-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in oklab, #000 55%, transparent);
  color: #fff;
  backdrop-filter: blur(2px);
  transition:
    transform 0.2s var(--ease),
    background 0.2s;
}
.card-video:hover .thumb-play {
  transform: scale(1.08);
  background: var(--accent);
}
.thumb-dur {
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: color-mix(in oklab, #000 70%, transparent);
  padding: 3px 7px;
  border-radius: 6px;
}
</style>
