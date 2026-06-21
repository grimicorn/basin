import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import MarketingFooter from "~/components/MarketingFooter.vue";

describe("MarketingFooter", () => {
  it("renders the footer element", () => {
    const wrapper = shallowMount(MarketingFooter);
    expect(wrapper.find("footer.mfoot").exists()).toBe(true);
  });

  it("renders a pricing link", () => {
    const wrapper = shallowMount(MarketingFooter);
    expect(wrapper.find("a[href='/pricing']").exists()).toBe(true);
  });

  it("renders a dashboard link", () => {
    const wrapper = shallowMount(MarketingFooter);
    expect(wrapper.find("a[href='/dashboard']").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(MarketingFooter);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
