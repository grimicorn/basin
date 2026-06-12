export interface UserProfileState {
  firstName: string;
  lastName: string;
  saving: boolean;
  error: string | null;
  success: boolean;
}

export function useUserProfile() {
  const { user } = useUser();

  const firstName = ref(user.value?.firstName ?? "");
  const lastName = ref(user.value?.lastName ?? "");
  const saving = ref(false);
  const error = ref<string | null>(null);
  const success = ref(false);

  watch(
    () => user.value,
    (updatedUser) => {
      if (updatedUser) {
        firstName.value = updatedUser.firstName ?? "";
        lastName.value = updatedUser.lastName ?? "";
      }
    },
  );

  async function saveProfile() {
    if (!user.value) return;
    saving.value = true;
    error.value = null;
    success.value = false;
    try {
      await user.value.update({
        firstName: firstName.value,
        lastName: lastName.value,
      });
      success.value = true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to save profile";
    } finally {
      saving.value = false;
    }
  }

  async function uploadAvatar(file: File) {
    if (!user.value) return;
    saving.value = true;
    error.value = null;
    success.value = false;
    try {
      await user.value.setProfileImage({ file });
      success.value = true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to upload avatar";
    } finally {
      saving.value = false;
    }
  }

  return {
    firstName,
    lastName,
    saving,
    error,
    success,
    saveProfile,
    uploadAvatar,
  };
}
