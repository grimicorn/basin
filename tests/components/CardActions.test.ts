import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import CardActions from "~/components/CardActions.vue";
import { makeArticle } from "../fixtures";

describe("CardActions", () => {
  it("renders save and open buttons", () => {
    const wrapper = shallowMount(CardActions, {
      props: { item: makeArticle({ saved: false }) },
    });
    expect(wrapper.findAll("button")).toHaveLength(2);
  });

  it("emits save on save button click", async () => {
    const wrapper = shallowMount(CardActions, {
      props: { item: makeArticle() },
    });
    await wrapper.findAll("button")[0].trigger("click");
    expect(wrapper.emitted("save")).toHaveLength(1);
  });

  it("emits open on open button click", async () => {
    const wrapper = shallowMount(CardActions, {
      props: { item: makeArticle() },
    });
    await wrapper.findAll("button")[1].trigger("click");
    expect(wrapper.emitted("open")).toHaveLength(1);
  });

  it("matches snapshot (unsaved)", () => {
    const wrapper = shallowMount(CardActions, {
      props: { item: makeArticle({ saved: false }) },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (saved)", () => {
    const wrapper = shallowMount(CardActions, {
      props: { item: makeArticle({ saved: true }) },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
