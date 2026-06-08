import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import ReadingPage from "~/pages/settings/reading.vue";

describe("settings/reading page", () => {
  it("renders SettingsReading", () => {
    const wrapper = shallowMount(ReadingPage);
    expect(wrapper.find("settings-reading-stub").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(ReadingPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
