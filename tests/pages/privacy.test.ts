import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import PrivacyPage from "~/pages/privacy.vue";

describe("privacy page (/privacy)", () => {
  it("renders the page header", () => {
    const wrapper = shallowMount(PrivacyPage);
    expect(wrapper.find(".page-h1").text()).toBe("Privacy policy.");
  });

  it("renders a table of contents linking each section", () => {
    const wrapper = shallowMount(PrivacyPage);
    const tocLinks = wrapper.findAll(".toc a");
    expect(tocLinks).toHaveLength(8);
    expect(wrapper.find(".toc a[href='#overview']").exists()).toBe(true);
  });

  it("marks the first section active before scrolling", () => {
    const wrapper = shallowMount(PrivacyPage);
    expect(wrapper.find(".toc a[href='#overview']").classes()).toContain(
      "active",
    );
  });

  it("renders a heading for every toc entry", () => {
    const wrapper = shallowMount(PrivacyPage);
    expect(wrapper.findAll(".legal-body h2")).toHaveLength(8);
  });
});
