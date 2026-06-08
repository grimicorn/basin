<script setup>
import AvatarButton from "~/components/AvatarButton.vue";
const route = useRoute();
const { unreadCount, refresh } = useFeed();
const { state: appearance, themeIcon, cycleTheme } = useAppearance();
const { openSearch } = useSearch();
</script>

<template>
  <header class="appbar">
    <div class="wrap appbar-in">
      <NuxtLink to="/" class="brand"><RLogo :size="28" words /></NuxtLink>
      <nav class="nav">
        <NuxtLink
          to="/dashboard"
          :class="{ active: route.path === '/dashboard' }"
          >dashboard<span class="num">01</span></NuxtLink
        >
        <NuxtLink to="/settings" :class="{ active: route.path === '/settings' }"
          >settings<span class="num">02</span></NuxtLink
        >
      </nav>
      <div class="appbar-right">
        <button class="search-trigger" @click="openSearch">
          <RIcon name="search" :size="16" />
          <span class="st-label">Search everything…</span>
          <span class="kbd">⌘K</span>
        </button>
        <button class="icon-btn" title="Refresh feeds" @click="refresh">
          <RIcon name="refresh" :size="18" />
        </button>
        <button
          class="icon-btn"
          :class="{ 'has-dot': unreadCount > 0 }"
          title="Notifications"
        >
          <RIcon name="bell" :size="18" />
        </button>
        <button
          class="icon-btn"
          :title="'Theme: ' + appearance.theme"
          @click="cycleTheme"
        >
          <RIcon :name="themeIcon()" :size="18" />
        </button>
        <NuxtLink to="/settings" title="Account">
          <AvatarButton />
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<style>
.appbar {
  position: sticky;
  top: 0;
  z-index: 60;
  background: color-mix(in oklab, var(--bg) 82%, transparent);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid var(--border);
}
.appbar-in {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 18px;
}
.rlogo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}
.rlogo-mark {
  display: block;
}
.rlogo-words {
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}
.brand-sub {
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--muted);
  margin-left: 1px;
}

.nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
}
.nav a {
  font-size: 12.5px;
  color: var(--muted);
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.16s var(--ease);
  position: relative;
  cursor: pointer;
}
.nav a:hover {
  color: var(--ink);
  background: var(--surface-2);
}
.nav a.active {
  color: var(--ink);
}
.nav a.active::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 2px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
}
.nav a .num {
  font-size: 9px;
  color: var(--accent);
  vertical-align: super;
  margin-left: 2px;
}

.appbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s var(--ease);
}
.icon-btn:hover {
  color: var(--ink);
  background: var(--surface-2);
}
.icon-btn.on {
  color: var(--accent);
}
.icon-btn .ricon {
  display: block;
}
.icon-btn.has-dot {
  position: relative;
}
.icon-btn.has-dot::after {
  content: "";
  position: absolute;
  top: 8px;
  right: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 10px 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 12.5px;
  min-width: 180px;
  transition: all 0.16s var(--ease);
}
.search-trigger:hover {
  border-color: var(--accent);
}
.search-trigger .st-label {
  margin-right: auto;
}

@media (max-width: 720px) {
  .nav {
    display: none;
  }
  .search-trigger .st-label,
  .search-trigger .kbd {
    display: none;
  }
  .search-trigger {
    min-width: 0;
  }
}
</style>
