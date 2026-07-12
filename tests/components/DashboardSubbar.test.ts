import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import DashboardSubbar from "~/components/DashboardSubbar.vue";
import { useFeedStore } from "~/stores/feed";

function mountSubbar(props = {}) {
  return shallowMount(DashboardSubbar, {
    props: { isOnboarding: false, sourceCount: 0, ...props },
  });
}

describe("DashboardSubbar", () => {
  beforeEach(() => {
    const state = useFeedStore().state;
    state.items = [];
    state.loading = false;
    state.filter = "all";
    state.unreadOnly = false;
    state.layout = "timeline";
  });

  it("renders the page title", () => {
    const wrapper = mountSubbar();
    expect(wrapper.find(".page-title").text()).toBe("Your Feed");
  });

  it("shows the 'no sources yet' subtitle during onboarding", () => {
    const wrapper = mountSubbar({ isOnboarding: true });
    expect(wrapper.find(".page-sub").text()).toContain("no sources yet");
  });

  it("shows the source count in the subtitle when not onboarding", () => {
    const wrapper = mountSubbar({ isOnboarding: false, sourceCount: 3 });
    expect(wrapper.find(".page-sub").text()).toContain("3 sources");
  });

  it("renders a filter chip for every filter definition", () => {
    const wrapper = mountSubbar();
    const chips = wrapper.findAll(".filters .fchip");
    expect(chips).toHaveLength(useFeedStore().filterDefs.length);
  });

  it("toggles unread-only when the chip is clicked", async () => {
    const wrapper = mountSubbar();
    const state = useFeedStore().state;
    expect(state.unreadOnly).toBe(false);
    await wrapper.find(".subbar-tools .fchip").trigger("click");
    expect(state.unreadOnly).toBe(true);
  });

  it("sets the active filter when a filter chip is clicked", async () => {
    const wrapper = mountSubbar();
    const state = useFeedStore().state;
    // Second chip corresponds to filterDefs[1] ("article").
    await wrapper.findAll(".filters .fchip")[1].trigger("click");
    expect(state.filter).toBe("article");
  });
});
