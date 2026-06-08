import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import RLogo from "~/components/RLogo.vue";

describe("RLogo", () => {
  it("renders the mark svg", () => {
    const wrapper = shallowMount(RLogo, { props: { size: 30 } });
    expect(wrapper.find("svg.rlogo-mark").exists()).toBe(true);
  });

  it("does not render words by default", () => {
    const wrapper = shallowMount(RLogo, { props: {} });
    expect(wrapper.find(".rlogo-words").exists()).toBe(false);
  });

  it("renders words when words=true", () => {
    const wrapper = shallowMount(RLogo, { props: { words: true } });
    expect(wrapper.find(".rlogo-words").text()).toBe("Reader");
  });

  it("matches snapshot (mark only)", () => {
    const wrapper = shallowMount(RLogo, { props: { size: 30 } });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with words)", () => {
    const wrapper = shallowMount(RLogo, { props: { size: 30, words: true } });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
