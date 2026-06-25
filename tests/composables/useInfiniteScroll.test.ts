import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { useInfiniteScroll } from "~/composables/useInfiniteScroll";

type IntersectCallback = (_arg: IntersectionObserverEntry[]) => void;

// Capture the callback registered with IntersectionObserver so tests can
// trigger it directly, without needing a real browser intersection event.
let capturedCallback: IntersectCallback | null = null;
let capturedObserver: {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} | null = null;

function makeMockObserver(callback: IntersectCallback): IntersectionObserver {
  capturedCallback = callback;
  capturedObserver = {
    observe: vi.fn(),
    disconnect: vi.fn(),
  };
  return capturedObserver as unknown as IntersectionObserver;
}

function triggerIntersect(isIntersecting: boolean): void {
  if (!capturedCallback) {
    throw new Error("IntersectionObserver callback was never registered");
  }
  capturedCallback(
    [{ isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

// A minimal host component that mounts useInfiniteScroll with a live ref so
// we can test watch() and onUnmounted() lifecycle hooks.
function mountHost(onIntersect: () => void) {
  return mount({
    setup() {
      const sentinel = ref<HTMLElement | null>(null);
      useInfiniteScroll(sentinel, onIntersect);
      return { sentinel };
    },
    template: `<div ref="sentinel"></div>`,
  });
}

describe("useInfiniteScroll", () => {
  beforeEach(() => {
    capturedCallback = null;
    capturedObserver = null;
    vi.stubGlobal("IntersectionObserver", makeMockObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an IntersectionObserver when a sentinel element is provided", async () => {
    mountHost(vi.fn());
    await nextTick();
    expect(capturedObserver).not.toBeNull();
    expect(capturedObserver!.observe).toHaveBeenCalledOnce();
  });

  it("calls the onIntersect callback when the sentinel enters the viewport", async () => {
    const onIntersect = vi.fn();
    mountHost(onIntersect);
    await nextTick();
    triggerIntersect(true);
    expect(onIntersect).toHaveBeenCalledOnce();
  });

  it("does not call onIntersect when the entry is not intersecting", async () => {
    const onIntersect = vi.fn();
    mountHost(onIntersect);
    await nextTick();
    triggerIntersect(false);
    expect(onIntersect).not.toHaveBeenCalled();
  });

  it("disconnects the observer when the component is unmounted", async () => {
    const wrapper = mountHost(vi.fn());
    await nextTick();
    const observerAtMount = capturedObserver;
    wrapper.unmount();
    expect(observerAtMount!.disconnect).toHaveBeenCalledOnce();
  });

  it("does not create an observer when sentinel ref is null", async () => {
    const ctor = vi.fn(makeMockObserver);
    vi.stubGlobal("IntersectionObserver", ctor);

    mount({
      setup() {
        const sentinel = ref<HTMLElement | null>(null);
        // Provide a null ref and never assign a DOM element
        useInfiniteScroll(sentinel, vi.fn());
      },
      template: `<div></div>`,
    });
    await nextTick();
    // Constructor should never have been called — no element to observe
    expect(ctor).not.toHaveBeenCalled();
  });

  it("uses the default rootMargin option when none is provided", async () => {
    const ctor = vi.fn(makeMockObserver);
    vi.stubGlobal("IntersectionObserver", ctor);

    mountHost(vi.fn());
    await nextTick();

    // Default rootMargin is "200px"
    expect(ctor).toHaveBeenCalledWith(expect.any(Function), {
      rootMargin: "200px",
    });
  });

  it("respects a custom rootMargin option", async () => {
    const ctor = vi.fn(makeMockObserver);
    vi.stubGlobal("IntersectionObserver", ctor);

    mount({
      setup() {
        const sentinel = ref<HTMLElement | null>(null);
        useInfiniteScroll(sentinel, vi.fn(), { rootMargin: "50px" });
        return { sentinel };
      },
      template: `<div ref="sentinel"></div>`,
    });
    await nextTick();

    expect(ctor).toHaveBeenCalledWith(expect.any(Function), {
      rootMargin: "50px",
    });
  });
});
