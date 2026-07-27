<script setup>
const { failedCount, refreshFailedCount } = useSyncQueue();

const message = computed(() =>
  failedCount.value === 1
    ? "1 offline action couldn't be synced and won't be retried automatically."
    : `${failedCount.value} offline actions couldn't be synced and won't be retried automatically.`,
);

onMounted(() => {
  refreshFailedCount();
});
</script>

<template>
  <div v-if="failedCount > 0" class="sync-queue-alert">
    <AppAlert theme="warning" compact :message="message" />
  </div>
</template>

<style>
.sync-queue-alert {
  position: fixed;
  left: 50%;
  /* Sits above AppToast's transient 28px slot so the two never overlap. */
  bottom: 84px;
  transform: translateX(-50%);
  z-index: 9400;
  width: min(420px, calc(100vw - 32px));
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-sm);
}
</style>
