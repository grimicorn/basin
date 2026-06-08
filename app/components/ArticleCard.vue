<script setup>
defineProps({ item: { type: Object, required: true } });
defineEmits(["save", "open"]);
</script>

<template>
  <article
    class="card card-article"
    :class="{ unread: item.unread }"
    @click="$emit('open')"
  >
    <div class="card-head">
      <SourceTag :item="item" />
      <CardActions :item="item" @save="$emit('save')" @open="$emit('open')" />
    </div>
    <h3 class="card-title">{{ item.title }}</h3>
    <p class="card-excerpt">{{ item.excerpt }}</p>
    <div class="card-foot">
      <span class="card-meta">{{ item.meta }}</span>
      <div class="chips">
        <span v-for="t in item.tags" :key="t" class="chip">#{{ t }}</span>
      </div>
    </div>
  </article>
</template>
