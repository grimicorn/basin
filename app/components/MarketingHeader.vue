<script setup lang="ts">
const route = useRoute();
const { isSignedIn } = useAuth();
const appearanceStore = useAppearanceStore();
</script>

<template>
  <header class="mnav">
    <div class="wrap mnav-in">
      <NuxtLink to="/" class="rlogo" aria-label="Reader home">
        <RLogo :size="26" words />
      </NuxtLink>
      <nav class="links">
        <NuxtLink to="/#features">Features</NuxtLink>
        <NuxtLink to="/#how">How it works</NuxtLink>
        <NuxtLink to="/pricing" :class="{ active: route.path === '/pricing' }">
          Pricing
        </NuxtLink>
      </nav>
      <div class="mnav-cta">
        <button
          class="icon-btn"
          :title="'Theme: ' + appearanceStore.state.theme"
          :aria-label="'Toggle theme'"
          @click="appearanceStore.cycleTheme"
        >
          <RIcon :name="appearanceStore.themeIcon" :size="18" />
        </button>
        <template v-if="isSignedIn">
          <NuxtLink to="/dashboard" class="btn btn-primary">
            Open app
            <RIcon name="arrowRight" :size="16" />
          </NuxtLink>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="btn btn-ghost">Sign in</NuxtLink>
          <NuxtLink to="/login" class="btn btn-primary">
            Start free
            <RIcon name="arrowRight" :size="16" />
          </NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>
