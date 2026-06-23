import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import AboutPage from "~/pages/about.vue";

describe("about page (/about)", () => {
  it("renders the page header", () => {
    const wrapper = shallowMount(AboutPage);
    expect(wrapper.find(".page-top").exists()).toBe(true);
    expect(wrapper.find(".page-h1").exists()).toBe(true);
  });

  it("renders the six value cards", () => {
    const wrapper = shallowMount(AboutPage);
    expect(wrapper.findAll(".feat-grid .feature")).toHaveLength(6);
  });

  it("renders the story timeline", () => {
    const wrapper = shallowMount(AboutPage);
    expect(wrapper.findAll(".story .story-item")).toHaveLength(3);
  });

  it("renders the team members", () => {
    const wrapper = shallowMount(AboutPage);
    expect(wrapper.findAll(".team .member")).toHaveLength(4);
  });

  it("links to contact from the CTA", () => {
    const wrapper = shallowMount(AboutPage);
    expect(wrapper.find("a[href='/contact']").exists()).toBe(true);
  });
});
