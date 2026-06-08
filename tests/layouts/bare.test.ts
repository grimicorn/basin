import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import BareLayout from "~/layouts/bare.vue";

describe("bare layout", () => {
  it("renders slot content", () => {
    const wrapper = shallowMount(BareLayout, {
      slots: { default: "<div class='test-content'>Hello</div>" },
    });
    expect(wrapper.find(".test-content").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(BareLayout, {
      slots: { default: "<main />" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
