import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SettingsPage from "~/pages/settings.vue";

describe("settings page", () => {
  it("renders the settings layout", () => {
    const wrapper = shallowMount(SettingsPage);
    expect(wrapper.find(".settings").exists()).toBe(true);
  });

  it("renders nav links for each section", () => {
    const wrapper = shallowMount(SettingsPage);
    const links = wrapper.findAll(".set-nav a");
    const hrefs = links.map((a) => a.attributes("href"));
    expect(hrefs).toEqual([
      "/settings/feeds",
      "/settings/connections",
      "/settings/reading",
      "/settings/account",
    ]);
  });

  it("renders the content area for child pages", () => {
    const wrapper = shallowMount(SettingsPage);
    expect(wrapper.find(".set-main").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(SettingsPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
