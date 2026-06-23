<script setup>
definePageMeta({ layout: "bare" });
</script>

<template>
  <div class="auth">
    <aside class="auth-aside">
      <div class="glow"></div>
      <div class="brand"><RLogo :size="30" words /></div>
      <div class="auth-quote">
        <p>
          Everything you follow — articles, shows, videos, posts — arriving on
          one quiet, chronological page.
        </p>
        <div class="by">
          — no algorithm, no infinite scroll, just your sources
        </div>
        <div class="auth-srcs">
          <span class="auth-src src-rss"><RIcon name="rss" :size="18" /></span>
          <span class="auth-src src-podcast"
            ><RIcon name="mic" :size="18"
          /></span>
          <span class="auth-src src-video"
            ><RIcon name="video" :size="18"
          /></span>
          <span class="auth-src src-tweet"
            ><RIcon name="chat" :size="18"
          /></span>
        </div>
      </div>
    </aside>

    <div class="auth-main">
      <SignIn fallback-redirect-url="/dashboard" />
    </div>
  </div>
</template>

<style>
.auth {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
}
.auth-aside {
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  padding: 48px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.auth-aside .glow {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  right: -160px;
  top: -120px;
  background: radial-gradient(
    circle,
    color-mix(in oklab, var(--accent) 30%, transparent),
    transparent 65%
  );
  filter: blur(20px);
}
.auth-quote {
  margin-top: auto;
}
.auth-quote p {
  font-size: 20px;
  line-height: 1.5;
  color: var(--ink);
  letter-spacing: -0.01em;
  max-width: 460px;
  text-wrap: pretty;
}
.auth-quote .by {
  font-size: 12px;
  color: var(--muted);
  margin-top: 14px;
}
.auth-srcs {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}
.auth-src {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--c);
}

.auth-main {
  display: grid;
  place-items: center;
  padding: 40px;
}

@media (max-width: 820px) {
  .auth {
    grid-template-columns: 1fr;
  }
  .auth-aside {
    display: none;
  }
}
</style>
