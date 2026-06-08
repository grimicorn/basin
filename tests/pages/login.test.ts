import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import LoginPage from "~/pages/login.vue";

describe("login page", () => {
  it("renders the auth layout", () => {
    const wrapper = shallowMount(LoginPage);
    expect(wrapper.find(".auth").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(LoginPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
