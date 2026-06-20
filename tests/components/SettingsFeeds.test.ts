import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import SettingsFeeds from "~/components/SettingsFeeds.vue";

const rssItem = {
  id: 1,
  url: "https://example.com/feed.xml",
  title: "Test Feed",
  source: "rss",
  createdAt: null,
};
const podItem = {
  id: 2,
  url: "https://podcast.example.com/feed",
  title: null,
  source: "podcast",
  createdAt: null,
};

function stubFeeds(overrides: Partial<ReturnType<typeof makeStub>> = {}) {
  const stub = makeStub(overrides);
  vi.stubGlobal("useFeeds", () => stub);
  return stub;
}

function makeStub(
  overrides: {
    items?: (typeof rssItem)[];
    error?: string | null;
    detectedSource?: "rss" | "podcast" | null;
    pendingFeedUrl?: string | null;
  } = {},
) {
  return {
    items: ref(overrides.items ?? [rssItem, podItem]),
    newUrl: ref(""),
    loading: ref(false),
    isAdding: ref(false),
    discovering: ref(false),
    detecting: ref(false),
    error: ref(overrides.error ?? null),
    detectedSource: ref(overrides.detectedSource ?? null),
    sourceOverride: ref(null),
    pendingFeedUrl: ref(overrides.pendingFeedUrl ?? null),
    load: vi.fn(),
    add: vi.fn(),
    confirmAdd: vi.fn(),
    remove: vi.fn(),
  };
}

describe("SettingsFeeds", () => {
  beforeEach(() => stubFeeds());

  it("renders a row for each feed", () => {
    const wrapper = shallowMount(SettingsFeeds);
    expect(wrapper.findAll(".feed-row")).toHaveLength(2);
  });

  it("shows the feed title when available", () => {
    const wrapper = shallowMount(SettingsFeeds);
    expect(wrapper.find(".feed-name").text()).toBe("Test Feed");
  });

  it("falls back to the URL when title is null", () => {
    const wrapper = shallowMount(SettingsFeeds);
    const names = wrapper.findAll(".feed-name").map((n) => n.text());
    expect(names).toContain("https://podcast.example.com/feed");
  });

  it("calls remove with the feed id when the remove button is clicked", async () => {
    const stub = stubFeeds();
    const wrapper = shallowMount(SettingsFeeds);
    await wrapper.find(".icon-btn").trigger("click");
    expect(stub.remove).toHaveBeenCalledWith(1);
  });

  it("calls add when the Add feed button is clicked", async () => {
    const stub = stubFeeds();
    const wrapper = shallowMount(SettingsFeeds);
    await wrapper.find(".btn.btn-primary").trigger("click");
    expect(stub.add).toHaveBeenCalled();
  });

  it("shows the error message when error is set", () => {
    stubFeeds({ error: "Failed to load feeds" });
    const wrapper = shallowMount(SettingsFeeds);
    expect(wrapper.find(".feed-error").text()).toBe("Failed to load feeds");
  });

  it("shows empty state when there are no feeds", () => {
    stubFeeds({ items: [] });
    const wrapper = shallowMount(SettingsFeeds);
    expect(wrapper.findAll(".feed-row")).toHaveLength(0);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot with feeds", () => {
    const wrapper = shallowMount(SettingsFeeds);
    expect(wrapper.html()).toMatchSnapshot();
  });

  describe("detection confirmation UI", () => {
    it("shows the detect-confirm panel when detectedSource and pendingFeedUrl are set", () => {
      stubFeeds({
        detectedSource: "rss",
        pendingFeedUrl: "https://example.com/feed.xml",
      });
      const wrapper = shallowMount(SettingsFeeds);
      expect(wrapper.find(".detect-confirm").exists()).toBe(true);
    });

    it("hides the detect-confirm panel when pendingFeedUrl is null", () => {
      stubFeeds({ detectedSource: null, pendingFeedUrl: null });
      const wrapper = shallowMount(SettingsFeeds);
      expect(wrapper.find(".detect-confirm").exists()).toBe(false);
    });

    it("shows Detected: RSS label for an rss feed", () => {
      stubFeeds({
        detectedSource: "rss",
        pendingFeedUrl: "https://example.com/feed.xml",
      });
      const wrapper = shallowMount(SettingsFeeds);
      expect(wrapper.find(".detect-label").text()).toContain("RSS");
    });

    it("shows Detected: Podcast label for a podcast feed", () => {
      stubFeeds({
        detectedSource: "podcast",
        pendingFeedUrl: "https://podcast.example.com/feed.xml",
      });
      const wrapper = shallowMount(SettingsFeeds);
      expect(wrapper.find(".detect-label").text()).toContain("Podcast");
    });

    it("calls confirmAdd when the confirm button is clicked", async () => {
      const stub = stubFeeds({
        detectedSource: "rss",
        pendingFeedUrl: "https://example.com/feed.xml",
      });
      const wrapper = shallowMount(SettingsFeeds);
      await wrapper.find(".detect-actions .btn-primary").trigger("click");
      expect(stub.confirmAdd).toHaveBeenCalled();
    });

    it("matches snapshot with detect-confirm visible", () => {
      stubFeeds({
        detectedSource: "podcast",
        pendingFeedUrl: "https://podcast.example.com/feed.xml",
      });
      const wrapper = shallowMount(SettingsFeeds);
      expect(wrapper.html()).toMatchSnapshot();
    });
  });
});
