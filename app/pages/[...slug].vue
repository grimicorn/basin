<script setup>
import { useSearch } from "#imports";
// Catch-all route → in-app 404. Uses the bare layout (no header).
definePageMeta({ layout: "bare" });
const { openSearch } = useSearch();
</script>

<template>
  <div class="grid min-h-screen place-items-center p-10 text-center">
    <div>
      <div class="mb-7 flex justify-center opacity-90">
        <RLogo :size="74" />
      </div>
      <h1 class="m-0 text-[72px] leading-none font-bold tracking-tighter">
        404
      </h1>
      <div class="text-ink mt-3.5 mb-1.5 text-[16px]">
        This page wandered off the trail.
      </div>
      <p class="text-muted m-0 mb-7 text-[13px]">
        The feed you're looking for moved, expired, or never existed.
      </p>
      <div class="flex justify-center gap-2.5">
        <button class="btn btn-primary" @click="navigateTo('/dashboard')">
          <RIcon name="inbox" :size="16" /> Back to your feed
        </button>
        <button class="btn" @click="openSearch">
          <RIcon name="search" :size="16" /> Search
        </button>
      </div>
    </div>
  </div>
</template>
