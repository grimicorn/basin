export interface Feed {
  id: number;
  url: string;
  title: string | null;
  source: string;
  createdAt: string | null;
}

export interface PendingFeed {
  url: string;
  detectedSource: string;
  sourceOverride: string | null;
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
  const error = ref<string | null>(null);
  const pendingFeed = ref<PendingFeed | null>(null);

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

  async function discoverFeedUrl(
    rawUrl: string,
  ): Promise<{ feedUrl: string; detectedSource: string } | null> {
    const headers = await authHeaders();
    try {
      return await $fetch<{ feedUrl: string; detectedSource: string }>(
        "/api/feeds/discover",
        {
          method: "POST",
          body: { url: rawUrl },
          headers,
        },
      );
    } catch (err: unknown) {
      const statusCode =
        err instanceof Error &&
        "statusCode" in err &&
        typeof (err as { statusCode: unknown }).statusCode === "number"
          ? (err as { statusCode: number }).statusCode
          : null;

      if (statusCode === STATUS_NO_FEED_FOUND) return null;

      throw new DiscoveryError(
        err instanceof Error ? err.message : "Discovery request failed",
      );
    }
  }

  async function confirmAdd() {
    if (!pendingFeed.value) return;

    const { url, sourceOverride } = pendingFeed.value;
    isAdding.value = true;
    error.value = null;

    try {
      const feed = await $fetch<Feed>("/api/feeds", {
        method: "POST",
        body: {
          url,
          ...(sourceOverride !== null ? { sourceOverride } : {}),
        },
        headers: await authHeaders(),
      });
      items.value.unshift(feed);
      newUrl.value = "";
      pendingFeed.value = null;
    } catch {
      error.value = "Failed to add feed — check the URL and try again";
    } finally {
      isAdding.value = false;
    }
  }

  function cancelAdd() {
    pendingFeed.value = null;
    error.value = null;
  }

  function setSourceOverride(source: string | null) {
    if (!pendingFeed.value) return;
    pendingFeed.value = { ...pendingFeed.value, sourceOverride: source };
  }

  async function add() {
    const rawUrl = newUrl.value.trim();
    if (!rawUrl) return;

    error.value = null;
    discovering.value = true;

    try {
      const discovered = await discoverFeedUrl(rawUrl);
      discovering.value = false;

      if (!discovered) {
        error.value =
          "No feed found at that URL — check the address and try again";
        return;
      }

      pendingFeed.value = {
        url: discovered.feedUrl,
        detectedSource: discovered.detectedSource,
        sourceOverride: null,
      };
    } catch {
      discovering.value = false;
      error.value = "Something went wrong while finding the feed — try again";
    }
  }

  async function remove(id: number) {
    const idx = items.value.findIndex((feed) => feed.id === id);
    if (idx === -1) return;
    const [removed] = items.value.splice(idx, 1);
    error.value = null;
    try {
      await $fetch(`/api/feeds/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
    } catch {
      items.value.splice(idx, 0, removed);
      error.value = "Failed to remove feed";
    }
  }

  return {
    items,
    newUrl,
    loading,
    isAdding,
    discovering,
    error,
    pendingFeed,
    load,
    add,
    confirmAdd,
    cancelAdd,
    setSourceOverride,
    remove,
  };
}
