import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed } from "vue";
import { useUserProfile } from "~/composables/useUserProfile";

function makeMockUser(overrides = {}) {
  return {
    firstName: "Demo",
    lastName: "User",
    update: vi.fn().mockResolvedValue(undefined),
    setProfileImage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("useUserProfile", () => {
  beforeEach(() => {
    globalThis.useUser = () => ({
      user: computed(() => makeMockUser()),
    });
  });

  it("initialises firstName and lastName from the current user", () => {
    const { firstName, lastName } = useUserProfile();
    expect(firstName.value).toBe("Demo");
    expect(lastName.value).toBe("User");
  });

  it("starts with saving false, no error, and no success", () => {
    const { saving, error, success } = useUserProfile();
    expect(saving.value).toBe(false);
    expect(error.value).toBeNull();
    expect(success.value).toBe(false);
  });

  it("calls user.update with firstName and lastName on saveProfile", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    globalThis.useUser = () => ({
      user: computed(() => makeMockUser({ update: mockUpdate })),
    });

    const { firstName, lastName, saveProfile } = useUserProfile();
    firstName.value = "Jane";
    lastName.value = "Doe";
    await saveProfile();

    expect(mockUpdate).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Doe",
    });
  });

  it("sets success to true after a successful saveProfile", async () => {
    const { saveProfile, success } = useUserProfile();
    await saveProfile();
    expect(success.value).toBe(true);
  });

  it("sets error message when user.update rejects", async () => {
    const mockUpdate = vi.fn().mockRejectedValue(new Error("Network failure"));
    globalThis.useUser = () => ({
      user: computed(() => makeMockUser({ update: mockUpdate })),
    });

    const { saveProfile, error } = useUserProfile();
    await saveProfile();
    expect(error.value).toBe("Network failure");
  });

  it("resets saving to false even when update fails", async () => {
    const mockUpdate = vi.fn().mockRejectedValue(new Error("bad"));
    globalThis.useUser = () => ({
      user: computed(() => makeMockUser({ update: mockUpdate })),
    });

    const { saveProfile, saving } = useUserProfile();
    await saveProfile();
    expect(saving.value).toBe(false);
  });

  it("calls user.setProfileImage with the provided file on uploadAvatar", async () => {
    const mockSetProfileImage = vi.fn().mockResolvedValue(undefined);
    globalThis.useUser = () => ({
      user: computed(() =>
        makeMockUser({ setProfileImage: mockSetProfileImage }),
      ),
    });

    const { uploadAvatar } = useUserProfile();
    const fakeFile = new File(["content"], "avatar.png", {
      type: "image/png",
    });
    await uploadAvatar(fakeFile);

    expect(mockSetProfileImage).toHaveBeenCalledWith({ file: fakeFile });
  });

  it("sets success to true after a successful uploadAvatar", async () => {
    const { uploadAvatar, success } = useUserProfile();
    const fakeFile = new File(["content"], "avatar.png", {
      type: "image/png",
    });
    await uploadAvatar(fakeFile);
    expect(success.value).toBe(true);
  });

  it("sets error message when setProfileImage rejects", async () => {
    const mockSetProfileImage = vi
      .fn()
      .mockRejectedValue(new Error("Upload failed"));
    globalThis.useUser = () => ({
      user: computed(() =>
        makeMockUser({ setProfileImage: mockSetProfileImage }),
      ),
    });

    const { uploadAvatar, error } = useUserProfile();
    const fakeFile = new File(["content"], "avatar.png", {
      type: "image/png",
    });
    await uploadAvatar(fakeFile);
    expect(error.value).toBe("Upload failed");
  });

  it("does nothing when user is null and saveProfile is called", async () => {
    globalThis.useUser = () => ({
      user: computed(() => null),
    });

    const { saveProfile, saving } = useUserProfile();
    await saveProfile();
    expect(saving.value).toBe(false);
  });

  it("does nothing when user is null and uploadAvatar is called", async () => {
    globalThis.useUser = () => ({
      user: computed(() => null),
    });

    const { uploadAvatar, saving } = useUserProfile();
    const fakeFile = new File(["content"], "avatar.png", {
      type: "image/png",
    });
    await uploadAvatar(fakeFile);
    expect(saving.value).toBe(false);
  });
});
