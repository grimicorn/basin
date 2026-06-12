import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import { useGravatar } from "~/composables/useGravatar";
import { gravatarUrl } from "~/utils/gravatar";

// Stub Image so tests never make real network requests.
// We store callbacks on this shared object so each test can trigger them.
const imageStub = {
  src: "",
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
};

function makeImageConstructor() {
  return function ImageMock(_this?: unknown) {
    void _this;
    imageStub.src = "";
    imageStub.onload = null;
    imageStub.onerror = null;
    return imageStub;
  };
}

beforeEach(() => {
  imageStub.src = "";
  imageStub.onload = null;
  imageStub.onerror = null;
  vi.stubGlobal("Image", makeImageConstructor());
});

describe("useGravatar", () => {
  it("sets gravatarSrc to null initially when email is null", () => {
    const emailRef = ref<string | null>(null);
    const { gravatarSrc } = useGravatar(emailRef);
    expect(gravatarSrc.value).toBeNull();
  });

  it("sets gravatarSrc to the gravatar URL when the image loads", async () => {
    const emailRef = ref<string | null>("test@example.com");
    const { gravatarSrc } = useGravatar(emailRef);

    imageStub.onload?.();
    await nextTick();

    expect(gravatarSrc.value).toBe(gravatarUrl("test@example.com", 80));
  });

  it("keeps gravatarSrc null when the image returns a 404", async () => {
    const emailRef = ref<string | null>("noavatar@example.com");
    const { gravatarSrc } = useGravatar(emailRef);

    imageStub.onerror?.();
    await nextTick();

    expect(gravatarSrc.value).toBeNull();
  });

  it("resets to null and reloads when the email changes", async () => {
    const emailRef = ref<string | null>("first@example.com");
    const { gravatarSrc } = useGravatar(emailRef);

    // Simulate successful load for the first email
    imageStub.onload?.();
    await nextTick();
    expect(gravatarSrc.value).not.toBeNull();

    // Change email — gravatarSrc should reset while new image loads
    emailRef.value = "second@example.com";
    await nextTick();

    expect(gravatarSrc.value).toBeNull();
  });

  it("requests the correct Gravatar URL for the given email", () => {
    const email = "test@example.com";
    const emailRef = ref<string | null>(email);
    useGravatar(emailRef);

    expect(imageStub.src).toBe(gravatarUrl(email, 80));
  });

  it("respects a custom size parameter", () => {
    const email = "test@example.com";
    const emailRef = ref<string | null>(email);
    useGravatar(emailRef, 200);

    expect(imageStub.src).toContain("s=200");
  });

  it("does not request an image when email is null", () => {
    const emailRef = ref<string | null>(null);
    useGravatar(emailRef);
    expect(imageStub.src).toBe("");
  });
});
