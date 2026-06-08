<script setup>
defineProps({ item: { type: Object, required: true } });
defineEmits(["save", "open"]);
</script>

<template>
  <article class="card card-photo" @click="$emit('open')">
    <div class="ph ratio-photo" :data-label="item.thumb">
      <span class="photo-badge src-photo"
        ><RIcon name="photo" :size="12" /> Instagram</span
      >
    </div>
    <div class="photo-cap">
      <div class="card-head tight">
        <SourceTag :item="item" />
        <CardActions :item="item" @save="$emit('save')" @open="$emit('open')" />
      </div>
      <p class="photo-text">{{ item.caption }}</p>
      <span class="card-meta">{{ item.meta }}</span>
    </div>
  </article>
</template>

<style>
.card-photo {
  padding: 0;
}
.card-photo .ph {
  border-radius: 0;
}
.ratio-photo {
  aspect-ratio: 4/5;
}
.photo-badge {
  position: absolute;
  left: 10px;
  top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
  color: #fff;
  background: color-mix(in oklab, var(--c) 86%, #000);
  padding: 4px 8px;
  border-radius: 999px;
}
.photo-cap {
  padding: 13px var(--card-pad) var(--card-pad);
}
.photo-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink);
  margin: 0 0 8px;
  text-wrap: pretty;
}
</style>
