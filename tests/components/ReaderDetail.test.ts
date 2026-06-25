import { describe, it, expect, beforeEach, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import ReaderDetail from "~/components/ReaderDetail.vue";
import { useFeedStore } from "~/stores/feed";
import { makeArticle, makeVideo, makePodcast, makeTweet } from "../fixtures";

describe("ReaderDetail", () => {
  let state: ReturnType<typeof useFeedStore>["state"];

  beforeEach(() => {
    // setup.ts creates a fresh Pinia before each test; get the store here
    // so it shares the same instance that the component will use.
    state = useFeedStore().state;
    state.activeItem = null;
    vi.stubGlobal("open", vi.fn());
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

  it("matches snapshot (with active video)", async () => {
    state.activeItem = makeVideo() as never;
    const wrapper = shallowMount(ReaderDetail);
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with active podcast)", async () => {
    state.activeItem = makePodcast() as never;
    const wrapper = shallowMount(ReaderDetail);
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with active tweet)", async () => {
    state.activeItem = makeTweet() as never;
    const wrapper = shallowMount(ReaderDetail);
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });

  describe("header open-original button", () => {
    it("opens the item URL in a new tab when clicked", async () => {
      state.activeItem = makeArticle({
        url: "https://test.example.com/article-1",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const openOriginalButton = wrapper
        .findAll(".icon-btn")
        .find((btn) => btn.attributes("title") === "Open original");
      expect(openOriginalButton).toBeDefined();
      await openOriginalButton!.trigger("click");

      expect(window.open).toHaveBeenCalledWith(
        "https://test.example.com/article-1",
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("does nothing when item has no URL", async () => {
      state.activeItem = makeArticle({ url: null }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const openOriginalButton = wrapper
        .findAll(".icon-btn")
        .find((btn) => btn.attributes("title") === "Open original");
      await openOriginalButton!.trigger("click");

      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe("article body open-original anchor", () => {
    it("renders an anchor with correct href and target when url is present", async () => {
      state.activeItem = makeArticle({
        url: "https://test.example.com/article-1",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const anchor = wrapper.find('a[rel="noopener noreferrer"]');
      expect(anchor.exists()).toBe(true);
      expect(anchor.attributes("href")).toBe(
        "https://test.example.com/article-1",
      );
      expect(anchor.attributes("target")).toBe("_blank");
    });

    it("hides the anchor when url is null", async () => {
      state.activeItem = makeArticle({ url: null }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      expect(
        wrapper.find('article a[rel="noopener noreferrer"]').exists(),
      ).toBe(false);
    });
  });

  describe("video watch-on-youtube anchor", () => {
    it("renders an anchor with the video URL", async () => {
      state.activeItem = makeVideo({
        url: "https://www.youtube.com/watch?v=test123",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const anchor = wrapper.find('a[rel="noopener noreferrer"]');
      expect(anchor.exists()).toBe(true);
      expect(anchor.attributes("href")).toBe(
        "https://www.youtube.com/watch?v=test123",
      );
      expect(anchor.attributes("target")).toBe("_blank");
    });
  });

  describe("podcast play button", () => {
    it("opens mediaUrl in a new tab when mediaUrl is present", async () => {
      state.activeItem = makePodcast({
        mediaUrl: "https://podcast.example.com/episode-1.mp3",
        url: "https://podcast.example.com/episode-1",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const playButton = wrapper.find(".pod-play");
      await playButton.trigger("click");

      expect(window.open).toHaveBeenCalledWith(
        "https://podcast.example.com/episode-1.mp3",
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("falls back to url when mediaUrl is absent", async () => {
      state.activeItem = makePodcast({
        mediaUrl: null,
        url: "https://podcast.example.com/episode-1",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const playButton = wrapper.find(".pod-play");
      await playButton.trigger("click");

      expect(window.open).toHaveBeenCalledWith(
        "https://podcast.example.com/episode-1",
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("does nothing when both mediaUrl and url are absent", async () => {
      state.activeItem = makePodcast({ mediaUrl: null, url: null }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const playButton = wrapper.find(".pod-play");
      await playButton.trigger("click");

      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe("save (bookmark) button", () => {
    it("toggles saved state via feedStore.toggleSave when clicked", async () => {
      const article = makeArticle({ saved: false });
      state.activeItem = article as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const saveButton = wrapper
        .findAll(".icon-btn")
        .find((btn) => btn.attributes("title") === "Save for later");
      expect(saveButton).toBeDefined();
      await saveButton!.trigger("click");

      expect(state.activeItem?.saved).toBe(true);
    });

    it("reflects saved state in title and class", async () => {
      const article = makeArticle({ saved: true });
      state.activeItem = article as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      const saveButton = wrapper
        .findAll(".icon-btn")
        .find((btn) => btn.attributes("title") === "Saved");
      expect(saveButton).toBeDefined();
      expect(saveButton!.classes()).toContain("on");
    });
  });
});
