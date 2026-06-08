import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import PodcastCard from "~/components/PodcastCard.vue";
import { makePodcast } from "../fixtures";

describe("PodcastCard", () => {
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
});
