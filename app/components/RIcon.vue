<script setup>
import { computed } from "vue";
import { ICONS } from "~/lib/icons";

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
});

const inner = computed(() => ICONS[props.name] || "");
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <svg
    class="ricon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-html="inner"
  ></svg>
</template>
