import { describe, it, expect } from "vitest";
import { FEED_SOURCE_TO_ITEM_TYPE } from "~/utils/feedSources";

describe("FEED_SOURCE_TO_ITEM_TYPE", () => {
  it("maps rss to article", () => {
    expect(FEED_SOURCE_TO_ITEM_TYPE["rss"]).toBe("article");
  });

  it("maps podcast to podcast", () => {
    expect(FEED_SOURCE_TO_ITEM_TYPE["podcast"]).toBe("podcast");
  });

  it("maps video to video", () => {
    expect(FEED_SOURCE_TO_ITEM_TYPE["video"]).toBe("video");
  });

  it("maps tweet to tweet", () => {
    expect(FEED_SOURCE_TO_ITEM_TYPE["tweet"]).toBe("tweet");
  });

  it("returns undefined for unknown source types", () => {
    expect(FEED_SOURCE_TO_ITEM_TYPE["newsletter"]).toBeUndefined();
  });
});
