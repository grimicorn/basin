import { describe, it, expect, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import AvatarButton from "~/components/AvatarButton.vue";

function makeUser(overrides = {}) {
  return {
    firstName: "Demo",
    lastName: "User",
    fullName: "Demo User",
    imageUrl: "https://example.com/avatar.jpg",
    hasImage: false,
    ...overrides,
  };
}

describe("AvatarButton", () => {
  it("renders nothing when no user is signed in", () => {
    vi.stubGlobal("useUser", () => ({ user: ref(null) }));
    const wrapper = shallowMount(AvatarButton);
    expect(wrapper.find(".avatar-btn").exists()).toBe(false);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders initials when user has no image", () => {
    vi.stubGlobal("useUser", () => ({ user: ref(makeUser()) }));
    const wrapper = shallowMount(AvatarButton);
    expect(wrapper.find(".avatar-btn").text()).toBe("DU");
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders avatar image when user hasImage", () => {
    vi.stubGlobal("useUser", () => ({
      user: ref(makeUser({ hasImage: true })),
    }));
    const wrapper = shallowMount(AvatarButton);
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("https://example.com/avatar.jpg");
    expect(img.attributes("alt")).toBe("Demo User Avatar");
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows '?' when user has no first or last name", () => {
    vi.stubGlobal("useUser", () => ({
      user: ref(makeUser({ firstName: null, lastName: null, hasImage: false })),
    }));
    const wrapper = shallowMount(AvatarButton);
    expect(wrapper.find(".avatar-btn").text()).toBe("?");
    expect(wrapper.html()).toMatchSnapshot();
  });
});
