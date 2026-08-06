import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import ReaderDetail from "~/components/ReaderDetail.vue";
import DetailProse from "~/components/DetailProse.vue";
import { useFeedStore } from "~/stores/feed";
import { makeArticle, makeVideo, makePodcast, makeTweet } from "../fixtures";

describe("ReaderDetail", () => {
  let state: ReturnType<typeof useFeedStore>["state"];

  // Register DetailProse so shallowMount resolves and stubs it, letting us
  // assert the real props passed in (not a brittle stringified attribute) and
  // keeping snapshots free of unresolved-component warnings.
  const mountDetail = () =>
    shallowMount(ReaderDetail, {
      global: { components: { DetailProse } },
    });

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
    const wrapper = mountDetail();
    expect(wrapper.find(".detail-scrim").exists()).toBe(false);
  });

  it("renders the detail sheet when an item is active", async () => {
    state.activeItem = makeArticle() as never;
    const wrapper = mountDetail();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".detail-scrim").exists()).toBe(true);
  });

  it("matches snapshot (no active item)", () => {
    state.activeItem = null;
    const wrapper = mountDetail();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with active article)", async () => {
    state.activeItem = makeArticle() as never;
    const wrapper = mountDetail();
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with active video)", async () => {
    state.activeItem = makeVideo() as never;
    const wrapper = mountDetail();
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with active podcast)", async () => {
    state.activeItem = makePodcast() as never;
    const wrapper = mountDetail();
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (with active tweet)", async () => {
    state.activeItem = makeTweet() as never;
    const wrapper = mountDetail();
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });

  describe("header open-original button", () => {
    it("opens the item URL in a new tab when clicked", async () => {
      state.activeItem = makeArticle({
        url: "https://test.example.com/article-1",
      }) as never;
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const playButton = wrapper.find(".pod-play");
      await playButton.trigger("click");

      expect(window.open).toHaveBeenCalledWith(
        "https://podcast.example.com/episode-1",
        "_blank",
        "noopener,noreferrer",
      );
    });

    it("falls back to url when mediaUrl is unsafe", async () => {
      state.activeItem = makePodcast({
        mediaUrl: "javascript:alert(1)",
        url: "https://podcast.example.com/episode-1",
      }) as never;
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const playButton = wrapper.find(".pod-play");
      await playButton.trigger("click");

      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe("real content rendering", () => {
    it("passes the article's real content paragraphs to DetailProse", async () => {
      state.activeItem = makeArticle({
        content: "Real one.\n\nReal two.",
      }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const prose = wrapper.findComponent(DetailProse);
      expect(prose.props("paragraphs")).toEqual(["Real one.", "Real two."]);
    });

    it("passes an empty paragraph list and honest article empty text when content is absent", async () => {
      state.activeItem = makeArticle({ content: null }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const prose = wrapper.findComponent(DetailProse);
      expect(prose.props("paragraphs")).toEqual([]);
      expect(prose.props("emptyText")).toContain(
        "No article text was included",
      );
    });

    it("passes the podcast's real show notes to DetailProse", async () => {
      state.activeItem = makePodcast({
        content: "Note one.\n\nNote two.",
      }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const prose = wrapper.findComponent(DetailProse);
      expect(prose.props("paragraphs")).toEqual(["Note one.", "Note two."]);
    });

    it("passes an empty list and honest podcast empty text when content is absent", async () => {
      state.activeItem = makePodcast({ content: null }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const prose = wrapper.findComponent(DetailProse);
      expect(prose.props("paragraphs")).toEqual([]);
      expect(prose.props("emptyText")).toContain("No show notes were included");
    });

    it("passes the video's real description to DetailProse", async () => {
      state.activeItem = makeVideo({
        content: "Real video description.",
      }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const prose = wrapper.findComponent(DetailProse);
      expect(prose.props("paragraphs")).toEqual(["Real video description."]);
    });

    it("passes an empty list and honest video empty text when content is absent", async () => {
      state.activeItem = makeVideo({ content: null }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const prose = wrapper.findComponent(DetailProse);
      expect(prose.props("paragraphs")).toEqual([]);
      expect(prose.props("emptyText")).toContain("No description was included");
    });

    it("renders the real tweet body from content", async () => {
      state.activeItem = makeTweet({
        content: "The actual synced post text.",
      }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".detail-tweet").text()).toBe(
        "The actual synced post text.",
      );
    });

    it("shows an honest empty state for a tweet with no text", async () => {
      state.activeItem = makeTweet({ content: null }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".detail-tweet").text()).toBe(
        "This post has no text.",
      );
    });

    it("preserves paragraph breaks in a multi-paragraph tweet body", async () => {
      state.activeItem = makeTweet({ content: "One.\n\nTwo." }) as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const body = wrapper.find(".detail-tweet").text();
      expect(body).toContain("One.");
      expect(body).toContain("Two.");
      expect(body).toContain("\n");
    });

    it("renders no fabricated replies for a tweet", async () => {
      state.activeItem = makeTweet() as never;
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      expect(wrapper.html()).not.toContain("Replies");
      expect(wrapper.html()).not.toContain("in_the_replies");
      expect(wrapper.html()).not.toContain("ships_daily");
    });
  });

  describe("save (bookmark) button", () => {
    it("toggles saved state via feedStore.toggleSave when clicked", async () => {
      const article = makeArticle({ saved: false });
      state.activeItem = article as never;
      const wrapper = mountDetail();
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
      const wrapper = mountDetail();
      await wrapper.vm.$nextTick();

      const saveButton = wrapper
        .findAll(".icon-btn")
        .find((btn) => btn.attributes("title") === "Saved");
      expect(saveButton).toBeDefined();
      expect(saveButton!.classes()).toContain("on");
    });
  });
});
