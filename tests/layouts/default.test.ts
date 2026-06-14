import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import DefaultLayout from "~/layouts/default.vue";
import { useFeed } from "~/composables/useFeed";

const { state } = useFeed();

describe("default layout", () => {
  beforeEach(() => {
    state.loading = false;
  });

  it("renders the app shell", () => {
    const wrapper = shallowMount(DefaultLayout);
    expect(wrapper.find("app-header-stub").exists()).toBe(true);
  });

  it("shows the progress bar when loading", async () => {
    state.loading = true;
    const wrapper = shallowMount(DefaultLayout);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".topbar-progress").exists()).toBe(true);
  });

  it("hides the progress bar when not loading", async () => {
    state.loading = false;
    const wrapper = shallowMount(DefaultLayout);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".topbar-progress").exists()).toBe(false);
  });

  it("renders slot content", () => {
    const wrapper = shallowMount(DefaultLayout, {
      slots: { default: "<main class='page-content' />" },
    });
    expect(wrapper.find(".page-content").exists()).toBe(true);
  });

  it("matches snapshot (not loading)", () => {
    state.loading = false;
    const wrapper = shallowMount(DefaultLayout);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (loading)", async () => {
    state.loading = true;
    const wrapper = shallowMount(DefaultLayout);
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });
});
