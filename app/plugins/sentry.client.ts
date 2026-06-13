/**
 * Sentry user identification plugin.
 *
 * Watches the Clerk auth state and keeps the Sentry user in sync.
 * When a user signs in their ID is attached to every Sentry event;
 * when they sign out the user is cleared.
 */
import { watch } from "vue";
import { identifyUser, clearUser } from "~/lib/sentry";

export default defineNuxtPlugin(() => {
  const { user } = useUser();

  function syncSentryUser(
    currentUser:
      | { id?: string; primaryEmailAddress?: { emailAddress?: string } }
      | null
      | undefined,
  ) {
    if (!currentUser?.id) {
      clearUser();
      return;
    }

    identifyUser({
      id: currentUser.id,
      email: currentUser.primaryEmailAddress?.emailAddress,
    });
  }

  watch(user, syncSentryUser, { immediate: true });
});
