<script setup>
import { useAppearance, useFeed } from "#imports";
import { ref, reactive } from "vue";
import AvatarButton from "~/components/AvatarButton.vue";

const { state, addFeed, removeFeed, toggleConn } = useFeed();
const { state: appearance, accentList } = useAppearance();

const settingsTab = ref("feeds");
const prefs = reactive({ autoplay: false, compactNotif: true });

const { user } = useUser();
const clerk = useClerk();

function handleSignOut() {
  clerk.value?.signOut({ redirectUrl: "/login" });
}
</script>

<template>
  <main class="wrap">
    <div class="settings">
      <nav class="set-nav">
        <a
          :class="{ active: settingsTab === 'feeds' }"
          @click="settingsTab = 'feeds'"
          >Feeds</a
        >
        <a
          :class="{ active: settingsTab === 'connections' }"
          @click="settingsTab = 'connections'"
          >Connections</a
        >
        <a
          :class="{ active: settingsTab === 'reading' }"
          @click="settingsTab = 'reading'"
          >Reading</a
        >
        <a
          :class="{ active: settingsTab === 'account' }"
          @click="settingsTab = 'account'"
          >Account</a
        >
      </nav>

      <div class="set-main">
        <!-- FEEDS -->
        <section v-if="settingsTab === 'feeds'" class="set-section">
          <h2>RSS &amp; Podcasts</h2>
          <p class="desc">
            Paste any feed URL — Reader auto-detects whether it's an article
            feed or a podcast.
          </p>
          <div class="add-feed">
            <div class="field">
              <RIcon name="rss" :size="16" />
              <input
                v-model="state.newFeedUrl"
                placeholder="https://example.com/feed.xml"
                @keyup.enter="addFeed"
              />
            </div>
            <button class="btn btn-primary" @click="addFeed">
              <RIcon name="plus" :size="16" /> Add feed
            </button>
          </div>
          <div class="feed-list">
            <div v-for="fd in state.feeds" :key="fd.id" class="feed-row">
              <span class="feed-ic" :style="{ '--c': fd.color }"
                ><RIcon
                  :name="fd.type === 'podcast' ? 'mic' : 'rss'"
                  :size="16"
              /></span>
              <div class="feed-info">
                <div class="feed-name">{{ fd.name }}</div>
                <div class="feed-url">{{ fd.url }}</div>
              </div>
              <span v-if="fd.status === 'error'" class="feed-stat error"
                >fetch failed</span
              >
              <span v-else class="feed-stat count">{{ fd.count }} new</span>
              <button
                class="icon-btn"
                title="Remove"
                @click="removeFeed(fd.id)"
              >
                <RIcon name="trash" :size="16" />
              </button>
            </div>
          </div>
        </section>

        <!-- CONNECTIONS -->
        <section v-else-if="settingsTab === 'connections'" class="set-section">
          <h2>Connected accounts</h2>
          <p class="desc">
            Link YouTube, X, and Instagram to fold their timelines into your
            feed.
          </p>
          <div class="conn-grid">
            <div v-for="c in state.connections" :key="c.id" class="conn">
              <span class="conn-ic" :style="{ '--c': c.color }">
                <RIcon
                  :name="
                    c.id === 'youtube'
                      ? 'video'
                      : c.id === 'twitter'
                        ? 'chat'
                        : 'photo'
                  "
                  :size="22"
                />
              </span>
              <div class="conn-info">
                <div class="conn-name">
                  {{ c.name }} <span v-if="c.connected" class="live"></span>
                </div>
                <div class="conn-desc">{{ c.desc }}</div>
                <div v-if="c.connected" class="conn-since">
                  {{ c.account }} · {{ c.since }}
                </div>
              </div>
              <button
                class="btn"
                :class="{ 'btn-primary': !c.connected }"
                @click="toggleConn(c)"
              >
                {{ c.connected ? "Disconnect" : "Connect" }}
              </button>
            </div>
          </div>
        </section>

        <!-- READING -->
        <section v-else-if="settingsTab === 'reading'" class="set-section">
          <h2>Reading preferences</h2>
          <p class="desc">
            Appearance and behavior for your feed. Saved to this browser.
          </p>

          <div class="set-pref-row">
            <div>
              <div class="lbl">Theme</div>
              <div class="sub">System follows your device's appearance</div>
            </div>
            <div class="seg">
              <button
                :class="{ active: appearance.theme === 'system' }"
                @click="appearance.theme = 'system'"
              >
                <RIcon name="monitor" :size="14" /> System
              </button>
              <button
                :class="{ active: appearance.theme === 'light' }"
                @click="appearance.theme = 'light'"
              >
                <RIcon name="sun" :size="14" /> Light
              </button>
              <button
                :class="{ active: appearance.theme === 'dark' }"
                @click="appearance.theme = 'dark'"
              >
                <RIcon name="moon" :size="14" /> Dark
              </button>
            </div>
          </div>
          <div class="set-pref-row">
            <div>
              <div class="lbl">Accent color</div>
              <div class="sub">
                Used for highlights, links &amp; unread marks
              </div>
            </div>
            <div class="flex gap-2">
              <span
                v-for="a in accentList"
                :key="a.key"
                class="twk-sw"
                :class="{ on: appearance.accent === a.key }"
                :style="{ background: a.color }"
                :title="a.key"
                @click="appearance.accent = a.key"
              ></span>
            </div>
          </div>
          <div class="set-pref-row">
            <div>
              <div class="lbl">Reading font</div>
              <div class="sub">
                Body type for articles, posts &amp; captions
              </div>
            </div>
            <div class="seg">
              <button
                :class="{ active: appearance.reading === 'mono' }"
                @click="appearance.reading = 'mono'"
              >
                Mono
              </button>
              <button
                :class="{ active: appearance.reading === 'serif' }"
                @click="appearance.reading = 'serif'"
              >
                Serif
              </button>
            </div>
          </div>
          <div class="set-pref-row">
            <div>
              <div class="lbl">Spacing</div>
              <div class="sub">Density of cards in the feed</div>
            </div>
            <div class="seg">
              <button
                :class="{ active: appearance.density === 'compact' }"
                @click="appearance.density = 'compact'"
              >
                Compact
              </button>
              <button
                :class="{ active: appearance.density === 'cozy' }"
                @click="appearance.density = 'cozy'"
              >
                Cozy
              </button>
              <button
                :class="{ active: appearance.density === 'comfortable' }"
                @click="appearance.density = 'comfortable'"
              >
                Roomy
              </button>
            </div>
          </div>

          <div class="set-pref-row">
            <div>
              <div class="lbl">Show unread only</div>
              <div class="sub">Hide items you've already opened</div>
            </div>
            <button
              class="toggle"
              :class="{ on: state.unreadOnly }"
              @click="state.unreadOnly = !state.unreadOnly"
            ></button>
          </div>
          <div class="set-pref-row">
            <div>
              <div class="lbl">Autoplay media previews</div>
              <div class="sub">Play video &amp; audio on hover</div>
            </div>
            <button
              class="toggle"
              :class="{ on: prefs.autoplay }"
              @click="prefs.autoplay = !prefs.autoplay"
            ></button>
          </div>
          <div class="set-pref-row">
            <div>
              <div class="lbl">Compact notifications</div>
              <div class="sub">Batch new items into a daily digest</div>
            </div>
            <button
              class="toggle"
              :class="{ on: prefs.compactNotif }"
              @click="prefs.compactNotif = !prefs.compactNotif"
            ></button>
          </div>
          <div class="set-pref-row">
            <div>
              <div class="lbl">Default layout</div>
              <div class="sub">How your feed opens</div>
            </div>
            <div class="seg">
              <button
                :class="{ active: state.layout === 'timeline' }"
                @click="state.layout = 'timeline'"
              >
                Timeline
              </button>
              <button
                :class="{ active: state.layout === 'grid' }"
                @click="state.layout = 'grid'"
              >
                Grid
              </button>
              <button
                :class="{ active: state.layout === 'columns' }"
                @click="state.layout = 'columns'"
              >
                Columns
              </button>
            </div>
          </div>
        </section>

        <!-- ACCOUNT -->
        <section v-else class="set-section">
          <h2>Account</h2>
          <p class="desc">Manage your Reader account.</p>
          <div class="conn">
            <AvatarButton class="h-12 w-12" />
            <div class="conn-info">
              <div class="conn-name">{{ user?.fullName }}</div>
              <div class="conn-desc">
                {{ user?.primaryEmailAddress?.emailAddress }}
              </div>
              <div class="conn-since">
                Free plan · {{ state.items.length }} items today
              </div>
            </div>
            <button class="btn" @click="handleSignOut">
              <RIcon name="logout" :size="16" /> Sign out
            </button>
          </div>
        </section>
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
