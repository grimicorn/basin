<script setup>
import { computed } from "vue";
import { LOGO_MARKS } from "~/lib/icons";

const props = defineProps({
  size: { type: [Number, String], default: 30 },
  words: { type: Boolean, default: false },
  variant: { type: String, default: "stack" },
});

const mark = computed(() => LOGO_MARKS[props.variant] || LOGO_MARKS.stack);
</script>

<template>
  <span class="rlogo">
    <!-- eslint-disable vue/no-v-html -->
    <svg
      class="rlogo-mark"
      :width="size"
      :height="size"
      viewBox="0 0 64 64"
      v-html="mark"
    ></svg>
    <span v-if="words" class="rlogo-words">Reader</span>
  </span>
</template>
