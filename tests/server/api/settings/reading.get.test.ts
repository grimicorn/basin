import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();

vi.stubGlobal("useDb", () => ({
  query: { userSettings: { findFirst: mockFindFirst } },
}));

import handler from "../../../../server/api/settings/reading.get";

const mockSettings = {
  userId: 1,
  theme: "dark",
  accentColor: "teal",
  readingFont: "mono",
  spacing: "compact",
  radius: "round",
  layout: "grid",
  showUnreadOnly: true,
  autoplayMediaPreviews: false,
  compactNotifications: true,
  createdAt: null,
  updatedAt: null,
};

describe("GET /api/settings/reading", () => {
  beforeEach(() => vi.resetAllMocks());

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null } };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns stored settings when a row exists", async () => {
    mockFindFirst.mockResolvedValue(mockSettings);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual({
      theme: "dark",
      accentColor: "teal",
      readingFont: "mono",
      spacing: "compact",
      radius: "round",
      layout: "grid",
      showUnreadOnly: true,
      autoplayMediaPreviews: false,
      compactNotifications: true,
    });
  });

  it("returns defaults when no row exists yet", async () => {
    mockFindFirst.mockResolvedValue(null);
    const event = { context: { user: { id: 1 } } };
    const result = await handler(event);
    expect(result).toEqual({
      theme: "system",
      accentColor: "violet",
      readingFont: "serif",
      spacing: "cozy",
      radius: "sharp",
      layout: "timeline",
      showUnreadOnly: false,
      autoplayMediaPreviews: false,
      compactNotifications: false,
    });
  });

  it("queries with the authenticated user's id", async () => {
    mockFindFirst.mockResolvedValue(null);
    const event = { context: { user: { id: 42 } } };
    await handler(event);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 42 },
      }),
    );
  });
});
