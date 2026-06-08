export default defineNuxtPlugin(() => {
  const { flushSyncQueue } = useSyncQueue();

  window.addEventListener("online", () => {
    flushSyncQueue();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      flushSyncQueue();
    }
  });
});
