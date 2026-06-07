export interface Feed {
  id: number;
  url: string;
  title: string | null;
  source: string;
  createdAt: string | null;
}

export function useFeeds() {
  const { getToken } = useAuth();

  const items = ref<Feed[]>([]);
  const newUrl = ref("");
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  async function add() {
    const url = newUrl.value.trim();
    if (!url) return;
    error.value = null;
    try {
      const feed = await $fetch<Feed>("/api/feeds", {
        method: "POST",
        body: { url },
        headers: await authHeaders(),
      });
      items.value.unshift(feed);
      newUrl.value = "";
    } catch {
      error.value = "Failed to add feed — check the URL and try again";
    }
  }

  async function remove(id: number) {
    const idx = items.value.findIndex((f) => f.id === id);
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

  return { items, newUrl, loading, error, load, add, remove };
}
