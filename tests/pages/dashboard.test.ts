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

  it("renders the page title", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find(".page-title").text()).toBe("Your Feed");
  });

  it("shows onboarding when there are no real feeds", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find("dashboard-onboarding-stub").exists()).toBe(true);
    expect(wrapper.find(".feed").exists()).toBe(false);
  });

  it("shows 'no sources yet' subtitle during onboarding", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find(".page-sub").text()).toContain("no sources yet");
  });

  it("hides onboarding and shows feed when real feeds exist", async () => {
    stubWithFeed();
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({ items: [], total: 0, nextOffset: null }),
    );
    const wrapper = shallowMount(IndexPage);
    await flushPromises();
    expect(wrapper.find("dashboard-onboarding-stub").exists()).toBe(false);
    expect(wrapper.find(".feed").exists()).toBe(true);
  });

  it("calls loadFeeds on mount", () => {
    shallowMount(IndexPage);
    expect(mockLoadFeeds).toHaveBeenCalledOnce();
  });

  it("shows the real feed source count in the subtitle when feeds exist", async () => {
    stubWithFeed();
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue({ items: [], total: 0, nextOffset: null }),
    );
    const wrapper = shallowMount(IndexPage);
    await flushPromises();
    expect(wrapper.find(".page-sub").text()).toContain("1 sources");
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
