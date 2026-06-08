import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import RIcon from "~/components/RIcon.vue";

describe("RIcon", () => {
  it("renders an svg with the given size", () => {
    const wrapper = shallowMount(RIcon, {
      props: { name: "search", size: 20 },
    });
    expect(wrapper.find("svg").attributes("width")).toBe("20");
    expect(wrapper.find("svg").attributes("height")).toBe("20");
  });

  it("has the ricon class", () => {
    const wrapper = shallowMount(RIcon, { props: { name: "search" } });
    expect(wrapper.find("svg").classes()).toContain("ricon");
  });

  it("defaults size to 18", () => {
    const wrapper = shallowMount(RIcon, { props: { name: "search" } });
    expect(wrapper.find("svg").attributes("width")).toBe("18");
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(RIcon, {
      props: { name: "search", size: 18 },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
