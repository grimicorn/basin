import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import App from "~/app.vue";

describe("App", () => {
  it("renders the root div", () => {
    const wrapper = shallowMount(App);
    expect(wrapper.find("div").exists()).toBe(true);
  });

  it("includes overlay components", () => {
    const wrapper = shallowMount(App);
    const html = wrapper.html();
    expect(html).toContain("search-overlay-stub");
    expect(html).toContain("reader-detail-stub");
    expect(html).toContain("app-toast-stub");
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(App);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
