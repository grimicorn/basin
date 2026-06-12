import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockOnConflict = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.stubGlobal("useDb", () => ({ insert: mockInsert }));

import handler from "../../../../server/api/settings/reading.patch";

const storedSettings = {
  userId: 1,
  theme: "dark",
  accentColor: "teal",
  readingFont: "mono",
  spacing: "compact",
  radius: "default",
  layout: "grid",
  showUnreadOnly: true,
  autoplayMediaPreviews: false,
  compactNotifications: false,
  createdAt: null,
  updatedAt: null,
};

describe("PATCH /api/settings/reading", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockReturning.mockResolvedValue([storedSettings]);
    mockOnConflict.mockReturnValue({ returning: mockReturning });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it("throws 401 when unauthenticated", async () => {
    const event = { context: { user: null }, body: {} };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns the updated settings", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { theme: "dark" },
    };
    const result = await handler(event);
    expect(result).toEqual({
      theme: "dark",
      accentColor: "teal",
      readingFont: "mono",
      spacing: "compact",
      radius: "default",
      layout: "grid",
      showUnreadOnly: true,
      autoplayMediaPreviews: false,
      compactNotifications: false,
    });
  });

  it("throws 400 for an invalid theme value", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { theme: "rainbow" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid accentColor value", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { accentColor: "purple" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid readingFont value", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { readingFont: "comic-sans" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid spacing value", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { spacing: "huge" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid layout value", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { layout: "cards" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid radius value", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { radius: "none" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts a partial patch with only layout", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { layout: "grid" },
    };
    const result = await handler(event);
    expect(result.layout).toBe("grid");
  });

  it("accepts boolean fields", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { showUnreadOnly: true, compactNotifications: true },
    };
    const result = await handler(event);
    expect(result).toBeTruthy();
  });

  it("throws 400 when showUnreadOnly is not a boolean", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { showUnreadOnly: "yes" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when autoplayMediaPreviews is not a boolean", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { autoplayMediaPreviews: 1 },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when compactNotifications is not a boolean", async () => {
    const event = {
      context: { user: { id: 1 } },
      body: { compactNotifications: "true" },
    };
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });
});
