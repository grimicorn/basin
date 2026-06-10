import { describe, it, expect, beforeEach, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SearchOverlay from "~/components/SearchOverlay.vue";
import { useSearch } from "~/composables/useSearch";

vi.stubGlobal("$fetch", vi.fn().mockResolvedValue([]));

const { state } = useSearch();

describe("SearchOverlay", () => {
  beforeEach(() => {
    state.open = false;
    state.query = "";
    state.cursor = 0;
    state.results = [];
    state.searching = false;
  });

  it("renders nothing when closed", () => {
    state.open = false;
    const wrapper = shallowMount(SearchOverlay);
    expect(wrapper.find(".search-scrim").exists()).toBe(false);
  });

  it("renders the search modal when open", async () => {
    state.open = true;
    const wrapper = shallowMount(SearchOverlay);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".search-scrim").exists()).toBe(true);
    expect(wrapper.find(".search-modal").exists()).toBe(true);
  });

  it("shows only pages when there are no Algolia results", async () => {
    state.open = true;
    state.results = [];
    const wrapper = shallowMount(SearchOverlay);
    await wrapper.vm.$nextTick();
    const groups = wrapper.findAll(".sr-group");
    expect(groups.length).toBe(1);
    expect(groups[0].text()).toBe("Pages");
  });

  it("shows a Results group when Algolia hits are present", async () => {
    state.open = true;
    state.query = "test";
    state.results = [
      {
        objectID: "feed_item_1",
        guid: "guid-1",
        title: "Test Article",
        url: "https://example.com",
        content: null,
        tags: null,
        publishedAt: null,
      },
    ];
    const wrapper = shallowMount(SearchOverlay);
    await wrapper.vm.$nextTick();
    const groups = wrapper.findAll(".sr-group");
    expect(groups.some((g) => g.text() === "Results")).toBe(true);
  });

  it("shows a searching indicator when state.searching is true", async () => {
    state.open = true;
    state.searching = true;
    const wrapper = shallowMount(SearchOverlay);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".empty").exists()).toBe(true);
  });

  it("shows empty state when there are no matches and not searching", async () => {
    state.open = true;
    state.searching = false;
    state.results = [];
    state.query = "nomatches";
    const wrapper = shallowMount(SearchOverlay);
    await wrapper.vm.$nextTick();
    const empty = wrapper.find(".empty");
    expect(empty.exists()).toBe(true);
  });

  it("matches snapshot (closed)", () => {
    state.open = false;
    const wrapper = shallowMount(SearchOverlay);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (open, empty query, no results)", async () => {
    state.open = true;
    state.query = "";
    state.results = [];
    const wrapper = shallowMount(SearchOverlay);
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });
});
