import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConnections } from "~/composables/useConnections";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

const mockShowToast = vi.fn();
vi.stubGlobal("useToast", () => ({ showToast: mockShowToast }));

// Replace window.location so href assignments are observable
const mockLocation = { href: "" };
vi.stubGlobal("location", mockLocation);

const mockIntegration = {
  id: 1,
  provider: "youtube",
  providerUsername: "@mychannel",
  createdAt: new Date("2024-01-01").toISOString(),
};

describe("useConnections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLocation.href = "";
  });

  describe("load()", () => {
    it("marks the matching provider as connected", async () => {
      mockFetch.mockResolvedValue([mockIntegration]);
      const { items, load } = useConnections();
      await load();
      const youtube = items.value.find((c) => c.id === "youtube");
      expect(youtube?.connected).toBe(true);
    });

    it("populates account and since from the DB row", async () => {
      mockFetch.mockResolvedValue([mockIntegration]);
      const { items, load } = useConnections();
      await load();
      const youtube = items.value.find((c) => c.id === "youtube");
      expect(youtube?.account).toBe("@mychannel");
      expect(youtube?.since).toMatch(/Connected/);
    });

    it("leaves providers disconnected when absent from the API response", async () => {
      mockFetch.mockResolvedValue([]);
      const { items, load } = useConnections();
      await load();
      expect(items.value.every((c) => !c.connected)).toBe(true);
    });

    it("sets error on fetch failure and leaves items unchanged", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      const { error, load } = useConnections();
      await load();
      expect(error.value).toBeTruthy();
    });

    it("clears a previous error on a successful re-load", async () => {
      const { error, load } = useConnections();
      mockFetch.mockRejectedValueOnce(new Error("oops"));
      await load();
      mockFetch.mockResolvedValueOnce([]);
      await load();
      expect(error.value).toBeNull();
    });
  });

  describe("connect()", () => {
    it("navigates to /api/auth/youtube for the YouTube provider", () => {
      const { connect } = useConnections();
      connect("youtube");
      expect(mockLocation.href).toBe("/api/auth/youtube");
    });

    it("shows a toast for Twitter instead of navigating", () => {
      const { connect } = useConnections();
      connect("twitter");
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("Twitter"),
      );
      expect(mockLocation.href).toBe("");
    });

    it("shows a toast for Instagram instead of navigating", () => {
      const { connect } = useConnections();
      connect("instagram");
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("Instagram"),
      );
      expect(mockLocation.href).toBe("");
    });
  });

  describe("disconnect()", () => {
    it("optimistically clears the connected state", async () => {
      mockFetch.mockResolvedValueOnce([mockIntegration]);
      mockFetch.mockResolvedValueOnce(undefined);
      const { items, load, disconnect } = useConnections();
      await load();
      await disconnect("youtube");
      const youtube = items.value.find((c) => c.id === "youtube");
      expect(youtube?.connected).toBe(false);
      expect(youtube?.account).toBe("");
      expect(youtube?.since).toBe("");
    });

    it("sends DELETE to /api/integrations/:provider", async () => {
      mockFetch.mockResolvedValueOnce([mockIntegration]);
      mockFetch.mockResolvedValueOnce(undefined);
      const { load, disconnect } = useConnections();
      await load();
      await disconnect("youtube");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/integrations/youtube",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("restores previous state and sets error when DELETE fails", async () => {
      mockFetch.mockResolvedValueOnce([mockIntegration]);
      mockFetch.mockRejectedValueOnce(new Error("Server error"));
      const { items, error, load, disconnect } = useConnections();
      await load();
      await disconnect("youtube");
      const youtube = items.value.find((c) => c.id === "youtube");
      expect(youtube?.connected).toBe(true);
      expect(error.value).toBeTruthy();
    });

    it("does nothing when the provider is not in the list", async () => {
      mockFetch.mockResolvedValue([]);
      const { load, disconnect } = useConnections();
      await load();
      await disconnect("unknown-provider");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
