<template>
  <footer class="mfoot">
    <div class="wrap">
      <div class="mfoot-in">
        <div>
          <NuxtLink to="/" class="rlogo">
            <RLogo :size="24" words />
          </NuxtLink>
          <p class="blurb">
            Every feed you follow — articles, podcasts, videos, posts — in one
            quiet, chronological place.
          </p>
        </div>
        <div class="col">
          <h4>Product</h4>
          <NuxtLink to="/#features">Features</NuxtLink>
          <NuxtLink to="/pricing">Pricing</NuxtLink>
          <NuxtLink to="/dashboard">Open app</NuxtLink>
        </div>
        <div class="col">
          <h4>Sources</h4>
          <!-- Placeholder: link to source-specific pages once they exist -->
          <span>RSS &amp; Atom</span>
          <span>Podcasts</span>
          <span>YouTube</span>
          <span>X &amp; Instagram</span>
        </div>
        <div class="col">
          <h4>Company</h4>
          <!-- Placeholder: link to company pages once they exist -->
          <span>About</span>
          <span>Privacy</span>
          <span>Contact</span>
        </div>
      </div>
      <div class="mfoot-base">
        <span
          >© {{ new Date().getFullYear() }} Reader — a quiet place for your
          feeds.</span
        >
        <span>Built with JetBrains Mono · Nuxt 4</span>
      </div>
    </div>
  </footer>
</template>
