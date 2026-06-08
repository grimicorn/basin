import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SlugPage from "~/pages/[...slug].vue";

describe("[...slug] page (404)", () => {
  it("renders the 404 message", () => {
    const wrapper = shallowMount(SlugPage);
    expect(wrapper.find("h1").text()).toBe("404");
  });

  it("renders the Back to feed button", () => {
    const wrapper = shallowMount(SlugPage);
    const buttons = wrapper.findAll("button");
    expect(buttons.some((b) => b.text().includes("Back to your feed"))).toBe(
      true,
    );
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(SlugPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
