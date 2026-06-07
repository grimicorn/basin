<script setup>
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
</script>

<template>
  <span v-if="user" class="avatar-btn h-8 w-8">
    <img
      v-if="user.hasImage"
      :src="user.imageUrl"
      :alt="`${user.fullName} Avatar`"
    />
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
