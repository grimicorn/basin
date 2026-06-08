import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import PhotoCard from "~/components/PhotoCard.vue";
import { makePhoto } from "../fixtures";

describe("PhotoCard", () => {
  it("renders correctly", () => {
    const wrapper = shallowMount(PhotoCard, { props: { item: makePhoto() } });
    expect(wrapper.html()).toBeTruthy();
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(PhotoCard, { props: { item: makePhoto() } });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
