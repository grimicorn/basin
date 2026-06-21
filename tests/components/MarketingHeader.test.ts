import { describe, it, expect, vi, afterEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import MarketingHeader from "~/components/MarketingHeader.vue";

describe("MarketingHeader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the nav element", () => {
    const wrapper = shallowMount(MarketingHeader);
    expect(wrapper.find("header.mnav").exists()).toBe(true);
  });

  it("renders a logo link", () => {
    const wrapper = shallowMount(MarketingHeader);
    expect(wrapper.find("a[href='/']").exists()).toBe(true);
  });

  it("renders sign-in and start-free links when not signed in", () => {
    const wrapper = shallowMount(MarketingHeader);
    const links = wrapper.findAll("a[href='/login']");
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("renders open-app link when signed in", () => {
    vi.stubGlobal("useAuth", () => ({ isSignedIn: ref(true) }));
    const wrapper = shallowMount(MarketingHeader);
    expect(wrapper.find("a[href='/dashboard']").exists()).toBe(true);
  });

  it("matches snapshot — signed out", () => {
    const wrapper = shallowMount(MarketingHeader);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
