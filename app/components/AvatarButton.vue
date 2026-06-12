<script setup>
import { computed } from "vue";
import { useGravatar } from "~/composables/useGravatar";

const { user } = useUser();

const initials = computed(() => {
  if (!user.value) return "?";
  return (
    [user.value.firstName, user.value.lastName]
      .filter(Boolean)
      .map((n) => n[0].toUpperCase())
      .join("") || "?"
  );
});

const email = computed(
  () => user.value?.primaryEmailAddress?.emailAddress ?? null,
);

const { gravatarSrc } = useGravatar(email);

const avatarSrc = computed(() => {
  if (user.value?.hasImage) return user.value.imageUrl;
  return gravatarSrc.value;
});
</script>

<template>
  <span v-if="user" class="avatar-btn h-8 w-8">
    <img v-if="avatarSrc" :src="avatarSrc" :alt="`${user.fullName} Avatar`" />
    <template v-else>
      {{ initials }}
    </template>
  </span>
</template>

<style scoped>
.avatar-btn {
  border-radius: 50%;
  flex: none;
  cursor: pointer;
  border: 1px solid var(--border-strong);
  background: var(--accent-soft);
  color: var(--accent-soft-ink);
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
}
</style>
