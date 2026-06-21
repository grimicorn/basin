<script setup lang="ts">
const props = defineProps<{
  theme: "info" | "success" | "warning" | "error";
  title?: string;
  message?: string;
  compact?: boolean;
  dismissible?: boolean;
}>();

const emit = defineEmits<{ dismiss: [] }>();

const icons = {
  info: `<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 7.5h.01"></path>`,
  success: `<circle cx="12" cy="12" r="9"></circle><path d="M8.5 12.5l2.5 2.5 4.5-5"></path>`,
  warning: `<path d="M12 4 21.5 20H2.5L12 4Z"></path><path d="M12 10v4.5"></path><path d="M12 17.5h.01"></path>`,
  error: `<circle cx="12" cy="12" r="9"></circle><path d="M9 9l6 6M15 9l-6 6"></path>`,
};

const iconSize = computed(() => (props.compact ? 14 : 16));
const iconStroke = computed(() => (props.compact ? "2" : "1.8"));
</script>

<template>
  <div :class="['alert', theme, { compact }]" role="alert">
    <span class="alert-ic">
      <!-- eslint-disable vue/no-v-html -->
      <svg
        class="ricon"
        :width="iconSize"
        :height="iconSize"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        :stroke-width="iconStroke"
        stroke-linecap="round"
        stroke-linejoin="round"
        v-html="icons[theme]"
      />
      <!-- eslint-enable vue/no-v-html -->
    </span>
    <div class="alert-main">
      <div v-if="title && !compact" class="alert-title">{{ title }}</div>
      <div class="alert-msg">
        <slot>{{ message }}</slot>
      </div>
      <div v-if="$slots.actions" class="alert-actions">
        <slot name="actions" />
      </div>
    </div>
    <button
      v-if="dismissible"
      class="alert-x"
      aria-label="Dismiss"
      @click="emit('dismiss')"
    >
      <svg
        class="ricon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>
