<script setup>
const { failedCount, refreshFailedCount, retryFailedItems } = useSyncQueue();
const { showToast } = useToast();

const dismissed = ref(false);
const retrying = ref(false);

// A newly-quarantined item should always surface, even if the user
// previously dismissed the banner for an earlier, since-resolved batch.
watch(failedCount, (current, previous) => {
  if (current > previous) {
    dismissed.value = false;
  }
});

const message = computed(() =>
  failedCount.value === 1
    ? "1 offline action couldn't be synced and won't be retried automatically."
    : `${failedCount.value} offline actions couldn't be synced and won't be retried automatically.`,
);

async function retry() {
  retrying.value = true;
  try {
    await retryFailedItems();
  } catch {
    showToast("Retry failed — check your connection and try again");
  } finally {
    retrying.value = false;
  }
}

onMounted(() => {
  refreshFailedCount();
});
</script>

<template>
  <div v-if="failedCount > 0 && !dismissed" class="sync-queue-alert">
    <AppAlert
      theme="warning"
      compact
      dismissible
      :message="message"
      @dismiss="dismissed = true"
    >
      <template #actions>
        <button
          type="button"
          class="btn btn-ghost sync-queue-alert-retry"
          :disabled="retrying"
          @click="retry"
        >
          {{ retrying ? "Retrying…" : "Retry now" }}
        </button>
      </template>
    </AppAlert>
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
.sync-queue-alert-retry {
  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
</style>
