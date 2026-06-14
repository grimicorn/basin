<script setup>
const feedStore = useFeedStore();
</script>

<template>
  <div>
    <div v-if="feedStore.state.loading" class="topbar-progress"><i></i></div>
    <AppHeader />
    <slot />
  </div>
</template>
