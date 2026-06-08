import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import SettingsAccount from "~/components/SettingsAccount.vue";

function stubFeed(itemCount = 12) {
  vi.stubGlobal("useFeed", () => ({
    state: { items: Array.from({ length: itemCount }) },
  }));
}

describe("SettingsAccount", () => {
  beforeEach(() => stubFeed());

  it("displays the user's full name", () => {
    const wrapper = shallowMount(SettingsAccount);
    expect(wrapper.find(".conn-name").text()).toBe("Demo User");
  });

  it("displays the user's email", () => {
    const wrapper = shallowMount(SettingsAccount);
    expect(wrapper.find(".conn-desc").text()).toBe("demo@example.com");
  });

  it("shows item count in the plan line", () => {
    const wrapper = shallowMount(SettingsAccount);
    expect(wrapper.find(".conn-since").text()).toContain("12 items today");
  });

  it("calls signOut when sign out button is clicked", async () => {
    const signOut = vi.fn();
    vi.stubGlobal("useClerk", () => ref({ signOut }));
    const wrapper = shallowMount(SettingsAccount);
    await wrapper.find("button.btn").trigger("click");
    expect(signOut).toHaveBeenCalledWith({ redirectUrl: "/login" });
  });

  it("renders nothing for the avatar when user has no image (AvatarButton handles it)", () => {
    const wrapper = shallowMount(SettingsAccount);
    expect(wrapper.find("avatar-button-stub").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(SettingsAccount);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
