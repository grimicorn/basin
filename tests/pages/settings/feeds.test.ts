import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import FeedsPage from "~/pages/settings/feeds.vue";

describe("settings/feeds page", () => {
  it("renders SettingsFeeds", () => {
    const wrapper = shallowMount(FeedsPage);
    expect(wrapper.find("settings-feeds-stub").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(FeedsPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
