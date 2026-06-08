<script setup>
import { computed } from "vue";
import { SOURCES } from "~/lib/icons";

const props = defineProps({ item: { type: Object, required: true } });
const meta = computed(() => SOURCES[props.item.type]);
</script>

<template>
  <div class="src-tag" :class="meta.cls">
    <span class="src-ic"><RIcon :name="meta.icon" :size="13" /></span>
    <span class="src-name">{{ item.source }}</span>
    <span class="src-sep">·</span>
    <span class="src-time">{{ item.time }}</span>
  </div>
</template>

<style>
.src-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-size: 11.5px;
  color: var(--muted);
}
.src-ic {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: color-mix(in oklab, var(--c) 16%, transparent);
  color: var(--c);
  flex: none;
}
.src-name {
  color: var(--ink-2);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.src-sep {
  color: var(--faint);
}
.src-time {
  color: var(--muted);
  white-space: nowrap;
}
</style>
