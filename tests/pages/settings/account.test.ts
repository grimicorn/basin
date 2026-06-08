import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import AccountPage from "~/pages/settings/account.vue";

describe("settings/account page", () => {
  it("renders SettingsAccount", () => {
    const wrapper = shallowMount(AccountPage);
    expect(wrapper.find("settings-account-stub").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(AccountPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
