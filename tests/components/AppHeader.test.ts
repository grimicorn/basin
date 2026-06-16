import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import AppHeader from "~/components/AppHeader.vue";

function findRefreshButton(wrapper: ReturnType<typeof shallowMount>) {
  return wrapper
    .findAll("button.icon-btn")
    .find((button) => button.attributes("title") === "Refresh feeds");
}

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

  it("refresh button is enabled and not spinning when store is idle", () => {
    const wrapper = shallowMount(AppHeader);
    const feedStore = useFeedStore();
    feedStore.state.syncing = false;

    const refreshButton = findRefreshButton(wrapper);
    expect(refreshButton).toBeDefined();
    expect(refreshButton!.attributes("disabled")).toBeUndefined();
    expect(refreshButton!.classes()).not.toContain("spinning");
  });

  it("refresh button is disabled and spinning when store is syncing", async () => {
    const wrapper = shallowMount(AppHeader);
    const feedStore = useFeedStore();
    feedStore.state.syncing = true;
    await wrapper.vm.$nextTick();

    const refreshButton = findRefreshButton(wrapper);
    expect(refreshButton).toBeDefined();
    expect(refreshButton!.attributes("disabled")).toBeDefined();
    expect(refreshButton!.classes()).toContain("spinning");
  });

  it("clicking the refresh button calls feedStore.refresh", async () => {
    const wrapper = shallowMount(AppHeader);
    const feedStore = useFeedStore();
    feedStore.state.syncing = false;

    const refreshButton = findRefreshButton(wrapper);
    expect(refreshButton).toBeDefined();
    await refreshButton!.trigger("click");
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(AppHeader);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
