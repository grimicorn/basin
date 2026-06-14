import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import ReaderDetail from "~/components/ReaderDetail.vue";
import { useFeedStore } from "~/stores/feed";
import { makeArticle } from "../fixtures";

describe("ReaderDetail", () => {
  let state: ReturnType<typeof useFeedStore>["state"];

  beforeEach(() => {
    // setup.ts creates a fresh Pinia before each test; get the store here
    // so it shares the same instance that the component will use.
    state = useFeedStore().state;
    state.activeItem = null;
  });

  it("renders nothing when there is no active item", () => {
    state.activeItem = null;
    const wrapper = shallowMount(ReaderDetail);
    expect(wrapper.find(".detail-scrim").exists()).toBe(false);
  });

  it("renders the detail sheet when an item is active", async () => {
    state.activeItem = makeArticle() as never;
    const wrapper = shallowMount(ReaderDetail);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".detail-scrim").exists()).toBe(true);
  });

  it("matches snapshot (no active item)", () => {
    state.activeItem = null;
    const wrapper = shallowMount(ReaderDetail);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with active article)", async () => {
    state.activeItem = makeArticle() as never;
    const wrapper = shallowMount(ReaderDetail);
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });
});
