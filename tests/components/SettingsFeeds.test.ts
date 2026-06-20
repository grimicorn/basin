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
  overrides: { items?: (typeof rssItem)[]; error?: string | null } = {},
) {
  return {
    items: ref(overrides.items ?? [rssItem, podItem]),
    newUrl: ref(""),
    loading: ref(false),
    isAdding: ref(false),
    discovering: ref(false),
    error: ref(overrides.error ?? null),
    load: vi.fn(),
    add: vi.fn(),
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

  it("passes error to InputText when error is set", () => {
    stubFeeds({ error: "Failed to load feeds" });
    const wrapper = shallowMount(SettingsFeeds);
    expect(wrapper.find("input-text-stub").attributes("error")).toBe(
      "Failed to load feeds",
    );
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
});
