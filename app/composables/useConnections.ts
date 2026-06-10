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
    id: "twitter",
    name: "X / Twitter",
    desc: "Home timeline & lists",
    color: "var(--src-tweet)",
  },
  {
    id: "instagram",
    name: "Instagram",
    desc: "Following feed",
    color: "var(--src-photo)",
  },
];

const OAUTH_READY = new Set(["youtube", "twitter"]);

function formatSince(iso: string | null): string {
  if (!iso) return "";
  return `Connected ${new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

export function useConnections() {
  const { getToken } = useAuth();
  const { showToast } = useToast();

  const items = ref<Connection[]>(
    PROVIDERS.map((p) => ({ ...p, connected: false, account: "", since: "" })),
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
      const byProvider = new Map(rows.map((r) => [r.provider, r]));
      items.value = PROVIDERS.map((p) => {
        const row = byProvider.get(p.id);
        return {
          ...p,
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
    if (!OAUTH_READY.has(id)) {
      const name = PROVIDERS.find((p) => p.id === id)?.name ?? id;
      showToast(`${name} integration coming soon`);
      return;
    }
    window.location.href = `/api/auth/${id}`;
  }

  async function disconnect(id: string) {
    const idx = items.value.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const prev = { ...items.value[idx] };
    items.value[idx] = {
      ...items.value[idx],
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
      items.value[idx] = prev;
      error.value = "Failed to disconnect";
    }
  }

  return { items, loading, error, load, connect, disconnect };
}
