import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import ConnectionsPage from "~/pages/settings/connections.vue";

describe("settings/connections page", () => {
  it("renders SettingsConnections", () => {
    const wrapper = shallowMount(ConnectionsPage);
    expect(wrapper.find("settings-connections-stub").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(ConnectionsPage);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
