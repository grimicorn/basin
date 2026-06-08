import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SkeletonCard from "~/components/SkeletonCard.vue";

describe("SkeletonCard", () => {
  it("defaults to article kind", () => {
    const wrapper = shallowMount(SkeletonCard, { props: {} });
    expect(wrapper.find(".sk-card").classes()).toContain("sk-article");
  });

  it("applies the given kind class", () => {
    const wrapper = shallowMount(SkeletonCard, { props: { kind: "video" } });
    expect(wrapper.find(".sk-card").classes()).toContain("sk-video");
  });

  it("matches snapshot for article", () => {
    const wrapper = shallowMount(SkeletonCard, { props: { kind: "article" } });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot for video", () => {
    const wrapper = shallowMount(SkeletonCard, { props: { kind: "video" } });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot for tweet", () => {
    const wrapper = shallowMount(SkeletonCard, { props: { kind: "tweet" } });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
