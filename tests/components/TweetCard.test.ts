import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import TweetCard from "~/components/TweetCard.vue";
import { makeTweet } from "../fixtures";

describe("TweetCard", () => {
  it("renders correctly", () => {
    const wrapper = shallowMount(TweetCard, { props: { item: makeTweet() } });
    expect(wrapper.html()).toBeTruthy();
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(TweetCard, { props: { item: makeTweet() } });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
