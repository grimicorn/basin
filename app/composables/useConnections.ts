export interface Connection {
  id: string;
  name: string;
  desc: string;
  color: string;
  connected: boolean;
  account: string;
  since: string;
}

interface DbIntegration {
  id: number;
  provider: string;
  providerUsername: string | null;
  createdAt: string | null;
}

const PROVIDERS: Omit<Connection, "connected" | "account" | "since">[] = [
  {
    id: "youtube",
    name: "YouTube",
    desc: "Subscriptions & Watch Later",
    color: "var(--src-video)",
  },
  {
    id: "bluesky",
    name: "Bluesky",
    desc: "Following feed",
    color: "var(--src-tweet)",
  },
];

const OAUTH_PROVIDERS = new Set(["youtube"]);
const FORM_PROVIDERS = new Set(["bluesky"]);

function formatSince(iso: string | null): string {
  if (!iso) return "";
  return `Connected ${new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

export function useConnections() {
  const { getToken } = useAuth();
  const { showToast } = useToast();

  const items = ref<Connection[]>(
    PROVIDERS.map((provider) => ({
      ...provider,
      connected: false,
      account: "",
      since: "",
    })),
  );
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
      const rows = await $fetch<DbIntegration[]>("/api/integrations", {
        headers: await authHeaders(),
      });
      const byProvider = new Map(rows.map((row) => [row.provider, row]));
      items.value = PROVIDERS.map((provider) => {
        const row = byProvider.get(provider.id);
        return {
          ...provider,
          connected: !!row,
          account: row?.providerUsername ?? "",
          since: formatSince(row?.createdAt ?? null),
        };
      });
    } catch {
      error.value = "Failed to load connections";
    } finally {
      loading.value = false;
    }
  }

  function connect(id: string) {
    if (OAUTH_PROVIDERS.has(id)) {
      window.location.href = `/api/auth/${id}`;
      return;
    }

    if (!FORM_PROVIDERS.has(id)) {
      const name = PROVIDERS.find((provider) => provider.id === id)?.name ?? id;
      showToast(`${name} integration coming soon`);
    }
  }

  function normalizeBlueskyHandle(handle: string): string {
    handle = handle.trim();
    const stripped = handle.startsWith("@") ? handle.slice(1) : handle;
    if (!stripped.trim()) return "";
    return stripped.includes(".") ? stripped : `${stripped}.bsky.social`;
  }

  async function connectBluesky(handle: string, appPassword: string) {
    handle = normalizeBlueskyHandle(handle);
    if (!handle) {
      error.value = "Bluesky handle is required";
      throw new Error(error.value);
    }
    loading.value = true;
    error.value = null;
    try {
      const result = await $fetch<{ ok: boolean; handle: string }>(
        "/api/auth/bluesky",
        {
          method: "POST",
          headers: await authHeaders(),
          body: { handle, appPassword },
        },
      );
      await load();
      return result;
    } catch (err) {
      error.value = "Failed to connect Bluesky";
      throw err instanceof Error ? err : new Error(error.value);
    } finally {
      loading.value = false;
    }
  }

  async function disconnect(id: string) {
    const index = items.value.findIndex((connection) => connection.id === id);
    if (index === -1) return;
    const previous = { ...items.value[index] };
    items.value[index] = {
      ...items.value[index],
      connected: false,
      account: "",
      since: "",
    };
    error.value = null;
    try {
      await $fetch(`/api/integrations/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
    } catch {
      items.value[index] = previous;
      error.value = "Failed to disconnect";
    }
  }

  return { items, loading, error, load, connect, connectBluesky, disconnect };
}
