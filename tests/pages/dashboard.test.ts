import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import IndexPage from "~/pages/dashboard.vue";
import { useFeedStore } from "~/stores/feed";

describe("dashboard page", () => {
  let state: ReturnType<typeof useFeedStore>["state"];

  beforeEach(() => {
    state = useFeedStore().state;
    state.items = [];
    state.feeds = [];
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

  it("matches snapshot (empty feed)", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
