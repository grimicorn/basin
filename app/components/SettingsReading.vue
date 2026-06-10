<script setup>
import { reactive } from "vue";

const { state } = useFeed();
const { state: appearance, accentList } = useAppearance();
const prefs = reactive({ autoplay: false, compactNotif: true });
</script>

<template>
  <section class="set-section">
    <h2>Reading preferences</h2>
    <p class="desc">
      Appearance and behavior for your feed. Saved to your account.
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
        <div class="sub">Used for highlights, links &amp; unread marks</div>
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
        <div class="sub">Body type for articles, posts &amp; captions</div>
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
</template>
