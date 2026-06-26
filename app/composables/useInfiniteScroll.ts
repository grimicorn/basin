import { watch, onUnmounted } from "vue";
import type { Ref } from "vue";

const DEFAULT_ROOT_MARGIN = "200px";

export interface UseInfiniteScrollOptions {
  rootMargin?: string;
}

export function useInfiniteScroll(
  sentinel: Ref<HTMLElement | null>,
  onIntersect: () => void,
  options: UseInfiniteScrollOptions = {},
): void {
  const rootMargin = options.rootMargin ?? DEFAULT_ROOT_MARGIN;

  let observer: IntersectionObserver | null = null;

  function handleIntersection(entries: IntersectionObserverEntry[]): void {
    const entry = entries[0];
    if (!entry?.isIntersecting) {
      return;
    }
    onIntersect();
  }

  function observe(element: HTMLElement): void {
    observer = new IntersectionObserver(handleIntersection, { rootMargin });
    observer.observe(element);
  }

  function disconnect(): void {
    if (!observer) {
      return;
    }
    observer.disconnect();
    observer = null;
  }

  watch(
    sentinel,
    (element) => {
      disconnect();
      if (element) {
        observe(element);
      }
    },
    { immediate: true },
  );

  onUnmounted(disconnect);
}
