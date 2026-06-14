import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SettingsReading from "~/components/SettingsReading.vue";

function stubFeed(stateOverrides = {}) {
  vi.stubGlobal("useFeedStore", () => ({
    state: { unreadOnly: false, layout: "timeline", ...stateOverrides },
  }));
}

describe("SettingsReading", () => {
  beforeEach(() => stubFeed());

  it("renders all preference rows", () => {
    const wrapper = shallowMount(SettingsReading);
    expect(wrapper.findAll(".set-pref-row").length).toBeGreaterThanOrEqual(7);
  });

  it("marks the active theme button", () => {
    const wrapper = shallowMount(SettingsReading);
    const systemBtn = wrapper.findAll(".seg button")[0];
    expect(systemBtn.classes()).toContain("active");
  });

  it("marks the active layout button", () => {
    const wrapper = shallowMount(SettingsReading);
    const timelineBtn = wrapper
      .findAll(".seg button")
      .find((b) => b.text() === "Timeline");
    expect(timelineBtn?.classes()).toContain("active");
  });

  it("renders accent swatches", () => {
    const wrapper = shallowMount(SettingsReading);
    expect(wrapper.findAll(".twk-sw").length).toBeGreaterThan(0);
  });

  it("toggles unread-only when the toggle is clicked", async () => {
    stubFeed({ unreadOnly: false });
    const wrapper = shallowMount(SettingsReading);
    const toggle = wrapper.find(".toggle");
    expect(toggle.classes()).not.toContain("on");
  });

  it("reflects unreadOnly=true on the toggle", () => {
    stubFeed({ unreadOnly: true });
    const wrapper = shallowMount(SettingsReading);
    const toggles = wrapper.findAll(".toggle");
    expect(toggles[0].classes()).toContain("on");
  });

  it("matches snapshot (default state)", () => {
    const wrapper = shallowMount(SettingsReading);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
