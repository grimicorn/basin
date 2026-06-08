<template>
  <main class="wrap">
    <div class="settings">
      <nav class="set-nav">
        <NuxtLink to="/settings/feeds" active-class="active">Feeds</NuxtLink>
        <NuxtLink to="/settings/connections" active-class="active"
          >Connections</NuxtLink
        >
        <NuxtLink to="/settings/reading" active-class="active"
          >Reading</NuxtLink
        >
        <NuxtLink to="/settings/account" active-class="active"
          >Account</NuxtLink
        >
      </nav>

      <div class="set-main">
        <NuxtPage />
      </div>
    </div>
  </main>
</template>

<style>
.settings {
  padding: 30px 0 90px;
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 36px;
}
.set-nav {
  position: sticky;
  top: 88px;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.set-nav a {
  font-size: 12.5px;
  color: var(--muted);
  padding: 9px 12px;
  border-radius: 9px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}
.set-nav a:hover {
  background: var(--surface-2);
  color: var(--ink);
}
.set-nav a.active {
  background: var(--accent-soft);
  color: var(--accent-soft-ink);
  font-weight: 500;
}
.set-main {
  min-width: 0;
  max-width: 720px;
}
.set-section {
  margin-bottom: 44px;
}
.set-section > h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 4px;
}
.set-section > .desc {
  font-size: 12.5px;
  color: var(--muted);
  margin: 0 0 20px;
}
.feed-error {
  color: var(--src-video);
}

.add-feed {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.feed-list {
  display: flex;
  flex-direction: column;
}
.feed-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border);
}
.feed-row:last-child {
  border-bottom: 0;
}
.feed-ic {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: color-mix(in oklab, var(--c) 15%, transparent);
  color: var(--c);
}
.feed-info {
  min-width: 0;
  flex: 1;
}
.feed-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
}
.feed-url {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.feed-stat {
  font-size: 10.5px;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.feed-stat.ok {
  background: color-mix(in oklab, var(--src-rss) 14%, transparent);
  color: var(--src-rss);
}
.feed-stat.error {
  background: color-mix(in oklab, var(--src-video) 14%, transparent);
  color: var(--src-video);
}
.feed-stat.count {
  background: var(--surface-2);
  color: var(--muted);
}

/* connection cards */
.conn-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.conn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
}
.conn-ic {
  width: 46px;
  height: 46px;
  flex: none;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in oklab, var(--c) 16%, transparent);
  color: var(--c);
}
.conn-info {
  flex: 1;
  min-width: 0;
}
.conn-name {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 8px;
}
.conn-name .live {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--src-rss);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--src-rss) 25%, transparent);
}
.conn-desc {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.conn-since {
  font-size: 10.5px;
  color: var(--faint);
  margin-top: 3px;
}

/* toggle */
.toggle {
  width: 42px;
  height: 24px;
  border-radius: 999px;
  border: 0;
  background: var(--border-strong);
  cursor: pointer;
  position: relative;
  flex: none;
  transition: background 0.2s var(--ease);
}
.toggle::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s var(--ease);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.toggle.on {
  background: var(--accent);
}
.toggle.on::after {
  left: 21px;
}

.set-pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.set-pref-row:last-child {
  border: 0;
}
.set-pref-row .lbl {
  font-size: 13.5px;
  color: var(--ink);
}
.set-pref-row .sub {
  font-size: 11.5px;
  color: var(--muted);
  margin-top: 2px;
}

/* accent swatches */
.twk-sw {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--border);
  cursor: pointer;
  transition: transform 0.12s;
}
.twk-sw:hover {
  transform: scale(1.12);
}
.twk-sw.on {
  border-color: var(--ink);
}

@media (max-width: 820px) {
  .settings {
    grid-template-columns: 1fr;
  }
  .set-nav {
    flex-direction: row;
    flex-wrap: wrap;
    position: static;
  }
}
</style>
