<script setup>
import { onMounted, onUnmounted } from "vue";

// initialize theming on the client (reads DB settings, applies to <html>)
const { ready: appearanceReady } = useAppearance();

const { state: feed, setupWatchers, closeDetail, detailNav } = useFeed();
const { state: search, openSearch, closeSearch } = useSearch();

const isCmdK = (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";

const DETAIL_ACTIONS = {
  ArrowRight: (e) => {
    e.preventDefault();
    detailNav(1);
  },
  ArrowLeft: (e) => {
    e.preventDefault();
    detailNav(-1);
  },
  Escape: () => closeDetail(),
};

function handleCmdK(e) {
  if (!isCmdK(e)) return false;
  e.preventDefault();
  if (search.open) closeSearch();
  else openSearch();
  return true;
}

function handleDetailNav(e) {
  if (!feed.activeItem || search.open) return false;
  const action = DETAIL_ACTIONS[e.key];
  if (action) {
    action(e);
    return true;
  }
  return false;
}

function handleSlash(e) {
  if (search.open || e.key !== "/") return;
  if (/input|textarea/i.test(e.target.tagName)) return;
  e.preventDefault();
  openSearch();
}

function onKey(e) {
  if (handleCmdK(e)) return;
  if (handleDetailNav(e)) return;
  handleSlash(e);
}

onMounted(() => {
  setupWatchers();
  window.addEventListener("keydown", onKey);
});
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="app-shell" :class="{ 'app-ready': appearanceReady }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- app-wide overlays -->
    <SearchOverlay />
    <ReaderDetail />
    <AppToast />
  </div>
</template>
