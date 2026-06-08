<script setup>
defineProps({ kind: { type: String, default: "article" } });
</script>

<template>
  <div class="card sk-card" :class="'sk-' + kind">
    <div v-if="kind === 'video' || kind === 'photo'" class="sk sk-thumb"></div>
    <div class="sk-pad">
      <div class="sk-row">
        <div class="sk sk-tag"></div>
        <div class="sk sk-dot2"></div>
      </div>
      <div class="sk sk-line w90"></div>
      <div class="sk sk-line w70"></div>
      <div v-if="kind !== 'tweet'" class="sk sk-line sm w50"></div>
    </div>
  </div>
</template>

<style>
.sk-card {
  cursor: default;
  pointer-events: none;
  padding: 0;
  overflow: hidden;
}
.sk-card:hover {
  transform: none;
  box-shadow: none;
  border-color: var(--border);
}
.sk-pad {
  padding: var(--card-pad);
}
.sk-thumb {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 0;
}
.sk-photo .sk-thumb {
  aspect-ratio: 4/5;
}
.sk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.sk-tag {
  width: 120px;
  height: 14px;
}
.sk-dot2 {
  width: 40px;
  height: 14px;
}
.sk-line {
  height: 13px;
  margin-bottom: 9px;
}
.sk-line.sm {
  height: 10px;
}
.w90 {
  width: 92%;
}
.w70 {
  width: 72%;
}
.w50 {
  width: 46%;
}
</style>
