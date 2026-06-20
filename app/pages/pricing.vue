<script setup lang="ts">
definePageMeta({ layout: "marketing" });

useHead({
  title: "Pricing — Reader",
  meta: [
    {
      name: "description",
      content:
        "Simple, quiet pricing. Start free forever. Upgrade to Pro when you outgrow ten sources.",
    },
  ],
});

const MONTHLY = { amt: "$8", bill: "billed monthly · 14-day free trial" };
const YEARLY = { amt: "$6", bill: "billed $72/year · 14-day free trial" };

const billing = ref<"month" | "year">("year");
const price = computed(() => (billing.value === "year" ? YEARLY : MONTHLY));

const faqItems = ref([
  {
    question: 'What counts as a "source"?',
    answer:
      "Any single feed or account you follow: one RSS URL, one podcast, one YouTube channel, or one connected account. Free includes up to ten; Pro is unlimited.",
    open: true,
  },
  {
    question: "How does the free trial work?",
    answer:
      "Pro starts with 14 days free — full access, no card charged. We email you two days before it ends. If you do nothing, you simply drop back to the Free plan.",
    open: false,
  },
  {
    question: "Can I switch between monthly and yearly?",
    answer:
      "Anytime. Yearly billing saves 25% over monthly. If you switch, we prorate the difference on your next invoice.",
    open: false,
  },
  {
    question: "What happens to my data if I downgrade?",
    answer:
      "Nothing is deleted. Sources beyond the free limit are paused (not removed) and your saved items stay intact — reactivate them whenever you upgrade again.",
    open: false,
  },
]);

function toggleFaq(index: number) {
  faqItems.value[index].open = !faqItems.value[index].open;
}
</script>

<template>
  <!-- ============ HEADER ============ -->
  <div class="wrap price-top">
    <span class="eyebrow dot" style="justify-content: center">Pricing</span>
    <h1 class="price-h1">Simple, quiet pricing.</h1>
    <p class="price-sub">
      Start free forever. Upgrade to Pro when you outgrow ten sources — and
      only then. Every paid plan starts with a 14-day free trial.
    </p>

    <div class="bill">
      <div class="seg">
        <button
          :class="{ active: billing === 'month' }"
          @click="billing = 'month'"
        >
          Monthly
        </button>
        <button
          :class="{ active: billing === 'year' }"
          @click="billing = 'year'"
        >
          Yearly
        </button>
      </div>
      <span class="save">Save 25%</span>
    </div>
  </div>

  <!-- ============ PLANS ============ -->
  <section class="section" style="border-top: 0; padding-top: 52px">
    <div class="wrap">
      <div class="plans">
        <!-- FREE -->
        <div class="plan">
          <div class="plan-head">
            <span class="plan-name">
              <span class="dot" style="background: var(--muted)" />
              Free
            </span>
          </div>
          <p class="plan-tagline">
            Everything one person needs to keep up with a handful of sources.
          </p>
          <div class="plan-price">
            <span class="plan-amt">$0</span>
            <span class="plan-per">forever</span>
          </div>
          <p class="plan-bill">No card required</p>
          <NuxtLink to="/login" class="btn">Get started</NuxtLink>
          <ul class="plan-feats">
            <li>
              <RIcon name="check" :size="16" />
              Up to <b>10 sources</b>
            </li>
            <li>
              <RIcon name="check" :size="16" />
              RSS, podcasts &amp; 1 connected account
            </li>
            <li>
              <RIcon name="check" :size="16" />
              Chronological timeline
            </li>
            <li>
              <RIcon name="check" :size="16" />
              <span class="kbd">⌘K</span> search across recent items
            </li>
            <li>
              <RIcon name="check" :size="16" />
              Light &amp; dark themes
            </li>
          </ul>
        </div>

        <!-- PRO -->
        <div class="plan featured">
          <div class="plan-head">
            <span class="plan-name">
              <span class="dot" style="background: var(--accent)" />
              Pro
            </span>
            <span class="plan-pop">Most popular</span>
          </div>
          <p class="plan-tagline">
            For people who follow everything, everywhere, and want it all in one
            stream.
          </p>
          <div class="plan-price">
            <span class="plan-amt">{{ price.amt }}</span>
            <span class="plan-per">/ month</span>
          </div>
          <p class="plan-bill">{{ price.bill }}</p>
          <NuxtLink to="/login" class="btn btn-primary">
            Start 14-day trial
            <RIcon name="arrowRight" :size="16" />
          </NuxtLink>
          <ul class="plan-feats">
            <li>
              <RIcon name="check" :size="16" />
              <b>Unlimited</b> sources
            </li>
            <li>
              <RIcon name="check" :size="16" />
              All connections — YouTube, X &amp; Instagram
            </li>
            <li>
              <RIcon name="check" :size="16" />
              Timeline, grid &amp; column layouts
            </li>
            <li>
              <RIcon name="check" :size="16" />
              Full-text search across all history
            </li>
            <li>
              <RIcon name="check" :size="16" />
              Saved items, read-later &amp; serif mode
            </li>
            <li>
              <RIcon name="check" :size="16" />
              Export, backup &amp; priority refresh
            </li>
          </ul>
        </div>
      </div>
      <p
        style="
          text-align: center;
          font-size: 11.5px;
          color: var(--muted);
          margin: 26px 0 0;
        "
      >
        Cancel anytime. We'll remind you before the trial ends — no surprise
        charges.
      </p>
    </div>
  </section>

  <!-- ============ FAQ ============ -->
  <section class="section">
    <div class="wrap">
      <div
        class="sec-head"
        style="justify-content: center; text-align: center; margin-bottom: 36px"
      >
        <div>
          <span class="eyebrow" style="justify-content: center">Questions</span>
          <h2 class="sec-title">Good to know.</h2>
        </div>
      </div>
      <div class="faq">
        <div
          v-for="(item, index) in faqItems"
          :key="index"
          :class="['faq-item', { open: item.open }]"
        >
          <button class="faq-q" @click="toggleFaq(index)">
            {{ item.question }}
            <RIcon name="plus" :size="18" />
          </button>
          <div class="faq-a">
            <div>
              <p>{{ item.answer }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ CTA BAND ============ -->
  <section class="section">
    <div class="wrap">
      <div class="cta-band">
        <span class="eyebrow dot" style="justify-content: center">
          Still reading?
        </span>
        <h2>Try Pro free for 14 days.</h2>
        <p>No card to start. Quiet by design, the moment you sign in.</p>
        <div class="hero-ctas">
          <NuxtLink to="/login" class="btn btn-primary btn-lg">
            Start free trial
            <RIcon name="arrowRight" :size="17" />
          </NuxtLink>
          <NuxtLink to="/" class="btn btn-lg">Back to home</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
