import { ref, watch, type Ref } from "vue";
import { gravatarUrl } from "~/utils/gravatar";

type MaybeEmail = string | null | undefined;

/**
 * Load a Gravatar image for the given email address.
 *
 * Returns a reactive `gravatarSrc` that is set to the Gravatar URL once the
 * image loads successfully, or `null` if the request returns a 404 (meaning
 * no Gravatar exists) or if no email is available.
 *
 * This composable isolates the external Gravatar service so callers can be
 * tested without making real network requests.
 */
export function useGravatar(emailRef: Ref<MaybeEmail>, size = 80) {
  const gravatarSrc = ref<string | null>(null);

  function loadGravatar(email: MaybeEmail) {
    gravatarSrc.value = null;

    if (!email) return;

    const url = gravatarUrl(email, size);
    const image = new Image();

    image.onload = () => {
      gravatarSrc.value = url;
    };

    image.onerror = () => {
      gravatarSrc.value = null;
    };

    image.src = url;
  }

  watch(emailRef, (email) => loadGravatar(email), { immediate: true });

  return { gravatarSrc };
}
