import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import AvatarButton from "~/components/AvatarButton.vue";

// Shared ref that tests can set before mounting to control what
// useGravatar returns without making real network requests.
const mockGravatarSrc = ref<string | null>(null);

vi.mock("~/composables/useGravatar", () => ({
  useGravatar: () => ({ gravatarSrc: mockGravatarSrc }),
}));

function makeUser(overrides = {}) {
  return {
    firstName: "Demo",
    lastName: "User",
    fullName: "Demo User",
    primaryEmailAddress: { emailAddress: "demo@example.com" },
    imageUrl: "https://example.com/avatar.jpg",
    hasImage: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockGravatarSrc.value = null;
});

describe("AvatarButton", () => {
  it("renders nothing when no user is signed in", () => {
    vi.stubGlobal("useUser", () => ({ user: ref(null) }));
    const wrapper = shallowMount(AvatarButton);
    expect(wrapper.find(".avatar-btn").exists()).toBe(false);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders initials when user has no image and no Gravatar", () => {
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

  it("renders Gravatar image when no profile image is set but Gravatar exists", () => {
    vi.stubGlobal("useUser", () => ({
      user: ref(makeUser({ hasImage: false })),
    }));
    mockGravatarSrc.value = "https://www.gravatar.com/avatar/abc123?d=404&s=80";
    const wrapper = shallowMount(AvatarButton);
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe(
      "https://www.gravatar.com/avatar/abc123?d=404&s=80",
    );
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("prefers the profile image over Gravatar when hasImage is true", () => {
    vi.stubGlobal("useUser", () => ({
      user: ref(makeUser({ hasImage: true })),
    }));
    // Even if Gravatar resolves, the user's own image takes priority
    mockGravatarSrc.value = "https://www.gravatar.com/avatar/abc123?d=404&s=80";
    const wrapper = shallowMount(AvatarButton);
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("https://example.com/avatar.jpg");
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
