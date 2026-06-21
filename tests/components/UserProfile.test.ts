import { describe, it, expect, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import UserProfile from "~/components/UserProfile.vue";

describe("UserProfile", () => {
  it("matches snapshot", () => {
    const wrapper = shallowMount(UserProfile);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders first and last name InputText components", () => {
    const wrapper = shallowMount(UserProfile);
    const inputs = wrapper.findAll("input-text-stub");
    expect(inputs).toHaveLength(2);
  });

  it("renders a save button", () => {
    const wrapper = shallowMount(UserProfile);
    const button = wrapper.find("button[type='submit']");
    expect(button.exists()).toBe(true);
  });

  it("renders a change avatar button", () => {
    const wrapper = shallowMount(UserProfile);
    const buttons = wrapper.findAll("button[type='button']");
    const avatarButton = buttons.find((b) =>
      b.text().toLowerCase().includes("avatar"),
    );
    expect(avatarButton?.exists()).toBe(true);
  });

  it("renders a hidden file input for avatar upload", () => {
    const wrapper = shallowMount(UserProfile);
    const fileInput = wrapper.find("input[type='file']");
    expect(fileInput.exists()).toBe(true);
    expect(fileInput.attributes("accept")).toBe("image/*");
  });

  it("passes error to last name InputText when error is present", () => {
    const originalUseUserProfile = globalThis.useUserProfile;
    globalThis.useUserProfile = () => ({
      firstName: ref("Demo"),
      lastName: ref("User"),
      saving: ref(false),
      error: ref("Failed to save profile"),
      success: ref(false),
      saveProfile: vi.fn(),
      uploadAvatar: vi.fn(),
    });

    const wrapper = shallowMount(UserProfile);
    const stubs = wrapper.findAll("input-text-stub");
    expect(stubs[1].attributes("error")).toBe("Failed to save profile");

    globalThis.useUserProfile = originalUseUserProfile;
  });

  it("passes success to last name InputText when save succeeds", () => {
    const originalUseUserProfile = globalThis.useUserProfile;
    globalThis.useUserProfile = () => ({
      firstName: ref("Demo"),
      lastName: ref("User"),
      saving: ref(false),
      error: ref(null),
      success: ref(true),
      saveProfile: vi.fn(),
      uploadAvatar: vi.fn(),
    });

    const wrapper = shallowMount(UserProfile);
    const stubs = wrapper.findAll("input-text-stub");
    expect(stubs[1].attributes("success")).toBe("Profile updated.");

    globalThis.useUserProfile = originalUseUserProfile;
  });

  it("disables save button while saving", () => {
    const originalUseUserProfile = globalThis.useUserProfile;
    globalThis.useUserProfile = () => ({
      firstName: ref("Demo"),
      lastName: ref("User"),
      saving: ref(true),
      error: ref(null),
      success: ref(false),
      saveProfile: vi.fn(),
      uploadAvatar: vi.fn(),
    });

    const wrapper = shallowMount(UserProfile);
    const saveButton = wrapper.find("button[type='submit']");
    expect(saveButton.attributes("disabled")).toBeDefined();

    globalThis.useUserProfile = originalUseUserProfile;
  });

  it("calls saveProfile when form is submitted", async () => {
    const saveProfile = vi.fn();
    const originalUseUserProfile = globalThis.useUserProfile;
    globalThis.useUserProfile = () => ({
      firstName: ref("Demo"),
      lastName: ref("User"),
      saving: ref(false),
      error: ref(null),
      success: ref(false),
      saveProfile,
      uploadAvatar: vi.fn(),
    });

    const wrapper = shallowMount(UserProfile);
    await wrapper.find("form").trigger("submit");
    expect(saveProfile).toHaveBeenCalledOnce();

    globalThis.useUserProfile = originalUseUserProfile;
  });
});
