<script setup>
const {
  firstName,
  lastName,
  saving,
  error,
  success,
  saveProfile,
  uploadAvatar,
} = useUserProfile();

const avatarInputRef = ref(null);

function openAvatarPicker() {
  avatarInputRef.value?.click();
}

async function handleAvatarChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await uploadAvatar(file);
  event.target.value = "";
}
</script>

<template>
  <form class="profile-form" @submit.prevent="saveProfile">
    <div class="profile-avatar-row">
      <AvatarButton class="h-16 w-16" />
      <div class="profile-avatar-actions">
        <button type="button" class="btn" @click="openAvatarPicker">
          <RIcon name="edit" :size="14" /> Change avatar
        </button>
        <input
          ref="avatarInputRef"
          type="file"
          accept="image/*"
          class="profile-avatar-input"
          aria-label="Upload avatar image"
          @change="handleAvatarChange"
        />
      </div>
    </div>

    <div class="profile-fields">
      <InputText
        id="profile-first-name"
        v-model="firstName"
        label="First name"
        placeholder="First name"
        :disabled="saving"
      />
      <InputText
        id="profile-last-name"
        v-model="lastName"
        label="Last name"
        placeholder="Last name"
        :disabled="saving"
        :error="error ?? undefined"
        :success="success ? 'Profile updated.' : undefined"
      />
    </div>

    <div class="profile-actions">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <span v-if="saving" class="spinner" />
        <template v-else>Save</template>
      </button>
    </div>
  </form>
</template>

<style scoped>
.profile-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-avatar-input {
  display: none;
}

.profile-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-actions {
  display: flex;
}
</style>
