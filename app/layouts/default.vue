<script setup>
import { useFeed } from "#imports";

const { state: feed } = useFeed();
</script>

<template>
  <div class="app-shell">
    <div v-if="feed.loading" class="topbar-progress"><i></i></div>
    <AppHeader />
    <slot />
  </div>
</template>
