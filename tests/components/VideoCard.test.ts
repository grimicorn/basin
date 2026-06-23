import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { useAppearanceStore } from "~/stores/appearance";
import VideoCard from "~/components/VideoCard.vue";
import { makeVideo } from "../fixtures";

const VIDEO_URL = "https://example.com/preview.mp4";

describe("VideoCard", () => {
  let appearanceStore: ReturnType<typeof useAppearanceStore>;

  beforeEach(() => {
    // setup.ts creates a fresh Pinia before each test — get the store here
    // so it shares the same instance the component will use.
    appearanceStore = useAppearanceStore();
    appearanceStore.state.autoplay = false;
  });

  it("renders correctly", () => {
    const wrapper = shallowMount(VideoCard, { props: { item: makeVideo() } });
    expect(wrapper.html()).toBeTruthy();
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(VideoCard, { props: { item: makeVideo() } });
    expect(wrapper.html()).toMatchSnapshot();
  });

  describe("autoplay wiring", () => {
    it("does not render a video element when autoplay is off", () => {
      appearanceStore.state.autoplay = false;
      const wrapper = shallowMount(VideoCard, {
        props: { item: makeVideo({ videoUrl: VIDEO_URL }) },
      });
      expect(wrapper.find("video").exists()).toBe(false);
    });

    it("does not render a video element when autoplay is on but item has no videoUrl", () => {
      appearanceStore.state.autoplay = true;
      const wrapper = shallowMount(VideoCard, {
        props: { item: makeVideo() },
      });
      expect(wrapper.find("video").exists()).toBe(false);
    });

    it("renders a video element with muted and playsinline when autoplay is on and item has a videoUrl", () => {
      appearanceStore.state.autoplay = true;
      const wrapper = shallowMount(VideoCard, {
        props: { item: makeVideo({ videoUrl: VIDEO_URL }) },
      });
      const video = wrapper.find("video");
      expect(video.exists()).toBe(true);
      expect(video.attributes("muted")).toBeDefined();
      expect(video.attributes("playsinline")).toBeDefined();
      expect(video.attributes("src")).toBe(VIDEO_URL);
    });

    it("renders a video element with the correct src", () => {
      appearanceStore.state.autoplay = true;
      const wrapper = shallowMount(VideoCard, {
        props: { item: makeVideo({ videoUrl: VIDEO_URL }) },
      });
      expect(wrapper.find("video").attributes("src")).toBe(VIDEO_URL);
    });
  });
});
