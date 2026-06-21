import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import InputTextarea from "~/components/InputTextarea.vue";

describe("InputTextarea", () => {
  it("renders a textarea element", () => {
    const wrapper = shallowMount(InputTextarea);
    expect(wrapper.find("textarea").exists()).toBe(true);
  });

  it("renders label when provided", () => {
    const wrapper = shallowMount(InputTextarea, {
      props: { label: "Notes" },
    });
    expect(wrapper.find("label").text()).toContain("Notes");
  });

  it("shows optional marker", () => {
    const wrapper = shallowMount(InputTextarea, {
      props: { label: "Notes", optional: true },
    });
    expect(wrapper.find(".opt").exists()).toBe(true);
  });

  it("applies is-error class when error is set", () => {
    const wrapper = shallowMount(InputTextarea, {
      props: { error: "Required" },
    });
    expect(wrapper.find(".field").classes()).toContain("is-error");
  });

  it("applies is-success class when success is set", () => {
    const wrapper = shallowMount(InputTextarea, { props: { success: true } });
    expect(wrapper.find(".field").classes()).toContain("is-success");
  });

  it("applies area class always", () => {
    const wrapper = shallowMount(InputTextarea);
    expect(wrapper.find(".field").classes()).toContain("area");
  });

  it("shows error helper text", () => {
    const wrapper = shallowMount(InputTextarea, {
      props: { error: "Too short" },
    });
    expect(wrapper.find(".fhelp.error").text()).toContain("Too short");
  });

  it("emits update:modelValue on input", async () => {
    const wrapper = shallowMount(InputTextarea);
    const textarea = wrapper.find("textarea");
    await textarea.setValue("some notes");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["some notes"]);
  });

  it("passes rows prop to textarea", () => {
    const wrapper = shallowMount(InputTextarea, { props: { rows: 6 } });
    expect(wrapper.find("textarea").attributes("rows")).toBe("6");
  });

  it("matches snapshot — default", () => {
    const wrapper = shallowMount(InputTextarea, {
      props: {
        label: "Notes",
        placeholder: "What do you want to remember?",
        optional: true,
      },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — error state", () => {
    const wrapper = shallowMount(InputTextarea, {
      props: { label: "Notes", error: "Cannot be empty" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
