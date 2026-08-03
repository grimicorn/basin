import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import ReaderDetail from "~/components/ReaderDetail.vue";
import { useFeedStore } from "~/stores/feed";
import { makeArticle, makeVideo, makePodcast, makeTweet } from "../fixtures";
import { isPlayableUrl } from "~/composables/usePodcastPlayer";

describe("ReaderDetail", () => {
  let state: ReturnType<typeof useFeedStore>["state"];

  beforeEach(() => {
    // setup.ts creates a fresh Pinia before each test; get the store here
    // so it shares the same instance that the component will use.
    state = useFeedStore().state;
    state.activeItem = null;
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    // Stub the shared player so we can assert on control calls without a real
    // <audio> element; canPlay uses the genuine URL-safety check.
    function stubPlayer() {
      const toggle = vi.fn();
      const player = {
        state: {
          currentUrl: null,
          playing: false,
          currentTime: 0,
          duration: 0,
        },
        progress: 0,
        seekStep: 15,
        play: vi.fn(),
        pause: vi.fn(),
        toggle,
        seekBy: vi.fn(),
        seekToFraction: vi.fn(),
        scrubTo: vi.fn(),
        isActive: () => false,
        isPlaying: () => false,
        canPlay: (url: string | null) => isPlayableUrl(url),
        formatTime: () => "0:00",
      };
      vi.stubGlobal("usePodcastPlayer", () => player);
      return { player, toggle };
    }

    it("plays the episode in-app instead of opening a new tab", async () => {
      const { toggle } = stubPlayer();
      state.activeItem = makePodcast({
        mediaUrl: "https://podcast.example.com/episode-1.mp3",
        url: "https://podcast.example.com/episode-1",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      await wrapper.find(".pod-play").trigger("click");

      expect(toggle).toHaveBeenCalledWith(
        "https://podcast.example.com/episode-1.mp3",
      );
      expect(window.open).not.toHaveBeenCalled();
    });

    it("disables the play button when mediaUrl is absent", async () => {
      stubPlayer();
      state.activeItem = makePodcast({
        mediaUrl: null,
        url: "https://podcast.example.com/episode-1",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".pod-play").attributes("disabled")).toBeDefined();
    });

    it("disables the play button when mediaUrl is unsafe", async () => {
      stubPlayer();
      state.activeItem = makePodcast({
        mediaUrl: "javascript:alert(1)",
        url: "https://podcast.example.com/episode-1",
      }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".pod-play").attributes("disabled")).toBeDefined();
    });

    it("never opens an external tab from the play button", async () => {
      stubPlayer();
      state.activeItem = makePodcast({ mediaUrl: null, url: null }) as never;
      const wrapper = shallowMount(ReaderDetail);
      await wrapper.vm.$nextTick();

      await wrapper.find(".pod-play").trigger("click");

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
