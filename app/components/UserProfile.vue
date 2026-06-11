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
      <div class="profile-field-row">
        <label class="profile-label" for="profile-first-name">First name</label>
        <div class="field">
          <input
            id="profile-first-name"
            v-model="firstName"
            type="text"
            placeholder="First name"
            :disabled="saving"
          />
        </div>
      </div>

      <div class="profile-field-row">
        <label class="profile-label" for="profile-last-name">Last name</label>
        <div class="field">
          <input
            id="profile-last-name"
            v-model="lastName"
            type="text"
            placeholder="Last name"
            :disabled="saving"
          />
        </div>
      </div>
    </div>

    <p v-if="error" class="profile-error">{{ error }}</p>
    <p v-if="success" class="profile-success">Profile updated.</p>

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

.profile-field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.profile-error {
  font-size: 12.5px;
  color: var(--src-video);
  margin: 0;
}

.profile-success {
  font-size: 12.5px;
  color: var(--src-rss);
  margin: 0;
}

.profile-actions {
  display: flex;
}
</style>
