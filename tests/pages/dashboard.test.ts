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
    state.connections = state.connections.map((c: Record<string, unknown>) => ({
      ...c,
      connected: false,
    }));
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

  it("shows onboarding when there are no feeds and no connected accounts", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find("dashboard-onboarding-stub").exists()).toBe(true);
    expect(wrapper.find(".feed").exists()).toBe(false);
  });

  it("shows 'no sources yet' subtitle during onboarding", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find(".page-sub").text()).toContain("no sources yet");
  });

  it("hides onboarding and shows feed when feeds exist", () => {
    state.feeds = [{ id: "1", type: "rss", name: "Test", url: "x.com", count: 0, color: "", status: "ok" }];
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find("dashboard-onboarding-stub").exists()).toBe(false);
    expect(wrapper.find(".feed").exists()).toBe(true);
  });

  it("hides onboarding when accounts are connected even with no feeds", () => {
    state.connections = [{ ...state.connections[0], connected: true }];
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.find("dashboard-onboarding-stub").exists()).toBe(false);
  });

  it("matches snapshot (onboarding state)", () => {
    const wrapper = shallowMount(IndexPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
