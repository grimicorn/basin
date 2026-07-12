import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount, flushPromises } from "@vue/test-utils";
import IndexPage from "~/pages/dashboard.vue";
import { useFeedStore } from "~/stores/feed";

const mockLoadFeeds = vi.fn().mockResolvedValue(undefined);

function stubEmptyFeeds() {
  vi.stubGlobal("useFeeds", () => ({
    items: ref([]),
    newUrl: ref(""),
    loading: ref(false),
    isAdding: ref(false),
    discovering: ref(false),
    error: ref(null),
    load: mockLoadFeeds,
    add: vi.fn(),
    remove: vi.fn(),
  }));
}

function stubWithFeed() {
  vi.stubGlobal("useFeeds", () => ({
    items: ref([
      {
        id: 1,
        url: "https://example.com/feed.xml",
        title: "Test",
        source: "rss",
        createdAt: null,
      },
    ]),
    newUrl: ref(""),
    loading: ref(false),
    isAdding: ref(false),
    discovering: ref(false),
    error: ref(null),
    load: mockLoadFeeds,
    add: vi.fn(),
    remove: vi.fn(),
  }));
}

describe("dashboard page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLoadFeeds.mockResolvedValue(undefined);
    stubEmptyFeeds();
    const state = useFeedStore().state;
    state.items = [];
    state.loading = false;
    state.filter = "all";
    state.unreadOnly = false;
    state.layout = "timeline";
  });

  it("renders the page wrapper", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find("main.wrap").exists()).toBe(true);
  });

  it("always renders the sub-bar", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find("dashboard-subbar-stub").exists()).toBe(true);
  });

  it("passes onboarding state and a zero source count to the sub-bar during onboarding", () => {
    const wrapper = shallowMount(IndexPage);
    const subbar = wrapper.find("dashboard-subbar-stub");
    expect(subbar.attributes("is-onboarding")).toBe("true");
    expect(subbar.attributes("source-count")).toBe("0");
  });

  it("shows onboarding and hides the feed when there are no real feeds", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find("dashboard-onboarding-stub").exists()).toBe(true);
    expect(wrapper.find("dashboard-feed-stub").exists()).toBe(false);
  });

  it("hides onboarding and shows the feed when real feeds exist", async () => {
    stubWithFeed();
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({ items: [], total: 0, nextOffset: null }),
    );
    const wrapper = shallowMount(IndexPage);
    await flushPromises();
    expect(wrapper.find("dashboard-onboarding-stub").exists()).toBe(false);
    expect(wrapper.find("dashboard-feed-stub").exists()).toBe(true);
  });

  it("calls loadFeeds on mount", () => {
    shallowMount(IndexPage);
    expect(mockLoadFeeds).toHaveBeenCalledOnce();
  });

  it("passes the real feed source count to the sub-bar when feeds exist", async () => {
    stubWithFeed();
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({ items: [], total: 0, nextOffset: null }),
    );
    const wrapper = shallowMount(IndexPage);
    await flushPromises();
    expect(
      wrapper.find("dashboard-subbar-stub").attributes("source-count"),
    ).toBe("1");
  });

  it("calls $fetch for feed items after loadFeeds resolves when feeds exist", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, nextOffset: null });
    vi.stubGlobal("$fetch", mockFetch);
    stubWithFeed();
    shallowMount(IndexPage);
    await flushPromises();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/feed-items",
      expect.any(Object),
    );
  });

  it("does not fetch feed items when there are no feeds", async () => {
    const mockFetch = vi.fn().mockResolvedValue(null);
    vi.stubGlobal("$fetch", mockFetch);
    stubEmptyFeeds();
    shallowMount(IndexPage);
    await flushPromises();
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/feed-items",
      expect.any(Object),
    );
  });

  it("matches snapshot (onboarding state)", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
