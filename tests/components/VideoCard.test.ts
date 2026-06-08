import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import VideoCard from "~/components/VideoCard.vue";
import { makeVideo } from "../fixtures";

describe("VideoCard", () => {
  it("renders correctly", () => {
    const wrapper = shallowMount(VideoCard, { props: { item: makeVideo() } });
    expect(wrapper.html()).toBeTruthy();
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(VideoCard, { props: { item: makeVideo() } });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
