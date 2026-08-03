import { describe, it, expect, vi, beforeEach } from "vitest";

// Deliberately does NOT mock feedLimit: this closes the loop between the two
// otherwise-mocked layers by exercising the real plan/count guard through
// createFeedForUser, so deleting the guard call would fail here.
const mockCount = vi.fn();
const mockWhere = vi.fn(() => mockCount());
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockFeedsFindFirst = vi.fn();
const mockReturning = vi.fn();
const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.stubGlobal("useDb", () => ({
  insert: mockInsert,
  select: mockSelect,
  query: { feeds: { findFirst: mockFeedsFindFirst } },
}));

vi.mock("../../../server/utils/subscriptions", () => ({
  getAccountPlan: vi.fn(),
}));

vi.mock("../../../server/utils/feedValidator", () => ({
  validateFeedContent: vi.fn(),
  fetchFeedBody: vi.fn(),
  FEED_FETCH_PROXY_URL: "",
}));

vi.mock("../../../server/utils/feedSourceDetector", () => ({
  detectFeedSource: vi.fn(),
}));

import { createFeedForUser } from "../../../server/utils/feedCreation";
import { FREE_PLAN_FEED_LIMIT } from "../../../server/utils/planLimits";
import { getAccountPlan } from "../../../server/utils/subscriptions";
import {
  validateFeedContent,
  fetchFeedBody,
} from "../../../server/utils/feedValidator";
import { detectFeedSource } from "../../../server/utils/feedSourceDetector";

const mockGetAccountPlan = vi.mocked(getAccountPlan);
const mockValidateFeedContent = vi.mocked(validateFeedContent);
const mockFetchFeedBody = vi.mocked(fetchFeedBody);
const mockDetectFeedSource = vi.mocked(detectFeedSource);

const NEW_URL = "https://example.com/brand-new.xml";

function planFor(plan: "free" | "pro") {
  return {
    plan,
    status: plan === "pro" ? "active" : "none",
    trialEnd: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

describe("createFeedForUser plan cap (real feedLimit guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedsFindFirst.mockResolvedValue(undefined);
    mockCount.mockResolvedValue([{ value: 0 }]);
    // Happy-path add mocks so an allowed call runs through to the insert.
    mockValidateFeedContent.mockResolvedValue(true);
    mockFetchFeedBody.mockResolvedValue("<rss></rss>");
    mockDetectFeedSource.mockReturnValue("rss");
    mockReturning.mockResolvedValue([
      { id: 1, userId: 1, url: NEW_URL, source: "rss", sourceOverride: null },
    ]);
  });

  it("rejects a Free user at the cap with 403 before validating or inserting", async () => {
    mockGetAccountPlan.mockResolvedValue(planFor("free"));
    mockCount.mockResolvedValue([{ value: FREE_PLAN_FEED_LIMIT }]);

    await expect(createFeedForUser(1, NEW_URL)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mockValidateFeedContent).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("allows the last slot but rejects the one over the cap (boundary)", async () => {
    mockGetAccountPlan.mockResolvedValue(planFor("free"));

    // One below the cap: the add is allowed and reaches the insert.
    mockCount.mockResolvedValue([{ value: FREE_PLAN_FEED_LIMIT - 1 }]);
    await expect(createFeedForUser(1, NEW_URL)).resolves.toMatchObject({
      detectedSource: "rss",
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);

    // At the cap: the next new source is refused.
    mockCount.mockResolvedValue([{ value: FREE_PLAN_FEED_LIMIT }]);
    await expect(createFeedForUser(1, NEW_URL)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
