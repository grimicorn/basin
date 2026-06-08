import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import AppHeader from "~/components/AppHeader.vue";

describe("AppHeader", () => {
  it("renders a header element", () => {
    const wrapper = shallowMount(AppHeader);
    expect(wrapper.find("header.appbar").exists()).toBe(true);
  });

  it("renders the brand logo link", () => {
    const wrapper = shallowMount(AppHeader);
    expect(wrapper.find(".brand").exists()).toBe(true);
  });

  it("renders the search trigger button", () => {
    const wrapper = shallowMount(AppHeader);
    expect(wrapper.find(".search-trigger").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(AppHeader);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
