import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import InputText from "~/components/InputText.vue";

describe("InputText", () => {
  it("renders an input element", () => {
    const wrapper = shallowMount(InputText);
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("renders label when provided", () => {
    const wrapper = shallowMount(InputText, { props: { label: "Email" } });
    expect(wrapper.find("label").text()).toContain("Email");
  });

  it("shows required asterisk", () => {
    const wrapper = shallowMount(InputText, {
      props: { label: "Email", required: true },
    });
    expect(wrapper.find(".req").exists()).toBe(true);
  });

  it("shows optional marker", () => {
    const wrapper = shallowMount(InputText, {
      props: { label: "Notes", optional: true },
    });
    expect(wrapper.find(".opt").exists()).toBe(true);
  });

  it("applies is-error class when error prop is set", () => {
    const wrapper = shallowMount(InputText, {
      props: { error: "Required field" },
    });
    expect(wrapper.find(".field").classes()).toContain("is-error");
  });

  it("applies is-success class when success prop is set", () => {
    const wrapper = shallowMount(InputText, { props: { success: true } });
    expect(wrapper.find(".field").classes()).toContain("is-success");
  });

  it("shows error helper text", () => {
    const wrapper = shallowMount(InputText, {
      props: { error: "Invalid email" },
    });
    expect(wrapper.find(".fhelp.error").text()).toContain("Invalid email");
  });

  it("shows success helper text when string", () => {
    const wrapper = shallowMount(InputText, {
      props: { success: "Looks good!" },
    });
    expect(wrapper.find(".fhelp.success").text()).toContain("Looks good!");
  });

  it("shows neutral helper text", () => {
    const wrapper = shallowMount(InputText, {
      props: { helperText: "Hint text" },
    });
    expect(wrapper.find(".fhelp").text()).toContain("Hint text");
  });

  it("emits update:modelValue on input", async () => {
    const wrapper = shallowMount(InputText);
    const input = wrapper.find("input");
    await input.setValue("hello");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["hello"]);
  });

  it("passes type prop to input", () => {
    const wrapper = shallowMount(InputText, { props: { type: "password" } });
    expect(wrapper.find("input").attributes("type")).toBe("password");
  });

  it("defaults type to text", () => {
    const wrapper = shallowMount(InputText);
    expect(wrapper.find("input").attributes("type")).toBe("text");
  });

  it("disables input when disabled prop is true", () => {
    const wrapper = shallowMount(InputText, { props: { disabled: true } });
    expect(wrapper.find("input").attributes("disabled")).toBeDefined();
  });

  it("renders icon slot", () => {
    const wrapper = shallowMount(InputText, {
      slots: { icon: '<svg data-testid="icon" />' },
    });
    expect(wrapper.html()).toContain("data-testid");
  });

  it("matches snapshot — default", () => {
    const wrapper = shallowMount(InputText, {
      props: { label: "Email", placeholder: "you@example.com" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — error state", () => {
    const wrapper = shallowMount(InputText, {
      props: { label: "Email", error: "Invalid address" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — success state", () => {
    const wrapper = shallowMount(InputText, {
      props: { label: "Email", success: "Looks good!" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — disabled", () => {
    const wrapper = shallowMount(InputText, {
      props: { label: "Workspace", disabled: true },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
