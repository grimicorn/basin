import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import DashboardFeedGrid from "~/components/DashboardFeedGrid.vue";
import { useFeedStore } from "~/stores/feed";

const PAGE_SIZE = 20;

function makeItems(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    type: "article",
  }));
}

describe("DashboardFeedGrid", () => {
  beforeEach(() => {
    const state = useFeedStore().state;
    state.items = [];
    state.loading = false;
    state.filter = "all";
    state.unreadOnly = false;
    state.layout = "timeline";
  });

  it("renders a feed item for each item within the window", () => {
    useFeedStore().state.items = makeItems(3);
    const wrapper = shallowMount(DashboardFeedGrid, {
      props: { stagger: false },
    });
    expect(wrapper.findAll("feed-item-stub")).toHaveLength(3);
  });

  it("shows the end-of-feed message when all items fit in the window", () => {
    useFeedStore().state.items = makeItems(3);
    const wrapper = shallowMount(DashboardFeedGrid, {
      props: { stagger: false },
    });
    expect(wrapper.find(".feed-end").exists()).toBe(true);
    expect(wrapper.find(".feed-sentinel").exists()).toBe(false);
  });

  it("windows to the page size and keeps the sentinel when more items remain", () => {
    useFeedStore().state.items = makeItems(PAGE_SIZE + 5);
    const wrapper = shallowMount(DashboardFeedGrid, {
      props: { stagger: false },
    });
    expect(wrapper.findAll("feed-item-stub")).toHaveLength(PAGE_SIZE);
    expect(wrapper.find(".feed-sentinel").exists()).toBe(true);
    expect(wrapper.find(".feed-end").exists()).toBe(false);
  });
});
