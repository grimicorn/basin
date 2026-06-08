import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SourceTag from "~/components/SourceTag.vue";
import { makeArticle, makeVideo } from "../fixtures";

describe("SourceTag", () => {
  it("renders for an article item", () => {
    const wrapper = shallowMount(SourceTag, {
      props: { item: makeArticle() },
    });
    expect(wrapper.html()).toBeTruthy();
  });

  it("renders for a video item", () => {
    const wrapper = shallowMount(SourceTag, {
      props: { item: makeVideo() },
    });
    expect(wrapper.html()).toBeTruthy();
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(SourceTag, {
      props: { item: makeArticle() },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
