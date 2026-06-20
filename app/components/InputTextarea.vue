<script setup lang="ts">
const props = defineProps<{
  modelValue?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  success?: boolean | string;
  disabled?: boolean;
  helperText?: string;
  id?: string;
  rows?: number;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const fieldClasses = computed(() => ({
  field: true,
  area: true,
  "is-success": !!props.success,
  "is-error": !!props.error,
  "is-disabled": props.disabled,
}));

const helpState = computed(() => {
  if (props.error) {
    return { text: props.error, type: "error" };
  }
  if (props.success && typeof props.success === "string") {
    return { text: props.success, type: "success" };
  }
  if (props.helperText) {
    return { text: props.helperText, type: "neutral" };
  }
  return null;
});

const showValidationIcon = computed(() => !!props.error || !!props.success);
</script>

<template>
  <div class="fgroup">
    <label v-if="label" :for="id">
      {{ label }}
      <span v-if="required" class="req">*</span>
      <span v-if="optional" class="opt">· optional</span>
    </label>
    <div :class="fieldClasses">
      <textarea
        :id="id"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
      <span v-if="showValidationIcon" class="val-ic">
        <svg
          class="ricon"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <template v-if="error">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
          </template>
        </svg>
      </span>
    </div>
    <div
      v-if="helpState"
      :class="['fhelp', helpState.type === 'neutral' ? '' : helpState.type]"
    >
      <svg
        v-if="helpState.type !== 'neutral'"
        class="ricon"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <template v-if="helpState.type === 'success'">
          <path d="M5 12.5l4.5 4.5L19 6.5" />
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5" />
          <path d="M12 16.5h.01" />
        </template>
      </svg>
      {{ helpState.text }}
    </div>
  </div>
</template>
