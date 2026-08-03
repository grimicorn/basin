import { describe, it, expect, vi, afterEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import PodcastCard from "~/components/PodcastCard.vue";
import { isPlayableUrl } from "~/composables/usePodcastPlayer";
import { makePodcast } from "../fixtures";

// Stub the shared player so play control is asserted without a real <audio>;
// canPlay uses the genuine URL-safety check to drive the disabled state.
function stubPlayer() {
  const toggle = vi.fn();
  const player = {
    state: { currentUrl: null, playing: false, currentTime: 0, duration: 0 },
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

describe("PodcastCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders correctly", () => {
    const wrapper = shallowMount(PodcastCard, {
      props: { item: makePodcast() },
    });
    expect(wrapper.html()).toBeTruthy();
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(PodcastCard, {
      props: { item: makePodcast() },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("toggles in-app playback with the episode media URL", async () => {
    const { toggle } = stubPlayer();
    const wrapper = shallowMount(PodcastCard, {
      props: {
        item: makePodcast({
          mediaUrl: "https://podcast.example.com/episode-1.mp3",
        }),
      },
    });

    await wrapper.find(".pod-play").trigger("click");

    expect(toggle).toHaveBeenCalledWith(
      "https://podcast.example.com/episode-1.mp3",
    );
  });

  it("disables the play button when there is no media URL", () => {
    stubPlayer();
    const wrapper = shallowMount(PodcastCard, {
      props: { item: makePodcast({ mediaUrl: null }) },
    });

    expect(wrapper.find(".pod-play").attributes("disabled")).toBeDefined();
  });
});
