export interface Feed {
  id: number;
  url: string;
  title: string | null;
  source: string;
  sourceOverride: "rss" | "podcast" | null;
  detectedSource?: "rss" | "podcast";
  createdAt: string | null;
}

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryError";
  }
}

const STATUS_NO_FEED_FOUND = 422;

export function useFeeds() {
  const { getToken } = useAuth();

  const items = ref<Feed[]>([]);
  const newUrl = ref("");
  const loading = ref(false);
  const isAdding = ref(false);
  const discovering = ref(false);
  const detecting = ref(false);
  const error = ref<string | null>(null);
  const detectedSource = ref<"rss" | "podcast" | null>(null);
  const sourceOverride = ref<"rss" | "podcast" | null>(null);
  const pendingFeedUrl = ref<string | null>(null);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken.value();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await $fetch<Feed[]>("/api/feeds", {
        headers: await authHeaders(),
      });
    } catch {
      error.value = "Failed to load feeds";
    } finally {
      loading.value = false;
    }
  }

  async function discoverFeedUrl(rawUrl: string): Promise<string | null> {
    const headers = await authHeaders();
    try {
      const result = await $fetch<{ feedUrl: string }>("/api/feeds/discover", {
        method: "POST",
        body: { url: rawUrl },
        headers,
      });
      return result.feedUrl;
    } catch (err: unknown) {
      const statusCode =
        err instanceof Error &&
        "statusCode" in err &&
        typeof (err as { statusCode: unknown }).statusCode === "number"
          ? (err as { statusCode: number }).statusCode
          : null;

      if (statusCode === STATUS_NO_FEED_FOUND) {
        return null;
      }

      throw new DiscoveryError(
        err instanceof Error ? err.message : "Discovery request failed",
      );
    }
  }

  async function detectSourceType(resolvedUrl: string): Promise<void> {
    detecting.value = true;
    detectedSource.value = null;
    sourceOverride.value = null;
    try {
      const result = await $fetch<{ detectedSource: "rss" | "podcast" }>(
        "/api/feeds/detect",
        {
          method: "POST",
          body: { url: resolvedUrl },
          headers: await authHeaders(),
        },
      );
      detectedSource.value = result.detectedSource;
      pendingFeedUrl.value = resolvedUrl;
    } catch {
      error.value =
        "Could not determine feed type — check the URL and try again";
    } finally {
      detecting.value = false;
    }
  }

  async function confirmAdd() {
    const resolvedUrl = pendingFeedUrl.value;
    if (!resolvedUrl) {
      return;
    }

    isAdding.value = true;
    try {
      const feed = await $fetch<Feed>("/api/feeds", {
        method: "POST",
        body: {
          url: resolvedUrl,
          sourceOverride: sourceOverride.value ?? undefined,
        },
        headers: await authHeaders(),
      });
      items.value.unshift(feed);
      newUrl.value = "";
      pendingFeedUrl.value = null;
      detectedSource.value = null;
      sourceOverride.value = null;
    } catch {
      error.value = "Failed to add feed — check the URL and try again";
    } finally {
      isAdding.value = false;
    }
  }

  async function add() {
    const rawUrl = newUrl.value.trim();
    if (!rawUrl) {
      return;
    }

    error.value = null;
    discovering.value = true;

    try {
      const resolvedUrl = await discoverFeedUrl(rawUrl);
      discovering.value = false;

      if (!resolvedUrl) {
        error.value =
          "No feed found at that URL — check the address and try again";
        return;
      }

      await detectSourceType(resolvedUrl);
    } catch {
      discovering.value = false;
      error.value = "Something went wrong while finding the feed — try again";
    }
  }

  async function remove(id: number) {
    const index = items.value.findIndex((feed) => feed.id === id);
    if (index === -1) {
      return;
    }
    const [removed] = items.value.splice(index, 1);
    error.value = null;
    try {
      await $fetch(`/api/feeds/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
    } catch {
      items.value.splice(index, 0, removed);
      error.value = "Failed to remove feed";
    }
  }

  return {
    items,
    newUrl,
    loading,
    isAdding,
    discovering,
    detecting,
    error,
    detectedSource,
    sourceOverride,
    pendingFeedUrl,
    load,
    add,
    confirmAdd,
    remove,
  };
}
