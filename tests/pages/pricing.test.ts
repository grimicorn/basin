import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import PricingPage from "~/pages/pricing.vue";

describe("pricing page (/pricing)", () => {
  it("renders the price header", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.find(".price-top").exists()).toBe(true);
  });

  it("renders the billing toggle", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.find(".bill").exists()).toBe(true);
    expect(wrapper.findAll(".bill .seg button")).toHaveLength(2);
  });

  it("defaults to yearly billing", () => {
    const wrapper = shallowMount(PricingPage);
    const buttons = wrapper.findAll(".bill .seg button");
    expect(buttons[1].classes()).toContain("active");
  });

  it("shows yearly price by default", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.find(".plan.featured .plan-amt").text()).toBe("$6");
  });

  it("switches to monthly price when toggle is clicked", async () => {
    const wrapper = shallowMount(PricingPage);
    const monthBtn = wrapper.findAll(".bill .seg button")[0];
    await monthBtn.trigger("click");
    expect(wrapper.find(".plan.featured .plan-amt").text()).toBe("$8");
  });

  it("renders two plan cards", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.findAll(".plan")).toHaveLength(2);
  });

  it("renders the featured (Pro) plan", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.find(".plan.featured").exists()).toBe(true);
  });

  it("renders the FAQ section", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.find(".faq").exists()).toBe(true);
  });

  it("renders four FAQ items", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.findAll(".faq-item")).toHaveLength(4);
  });

  it("first FAQ item is open by default", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.findAll(".faq-item")[0].classes()).toContain("open");
  });

  it("toggles FAQ item open state on click", async () => {
    const wrapper = shallowMount(PricingPage);
    const firstBtn = wrapper.findAll(".faq-q")[0];
    await firstBtn.trigger("click");
    expect(wrapper.findAll(".faq-item")[0].classes()).not.toContain("open");
  });

  it("renders the CTA band", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.find(".cta-band").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(PricingPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
