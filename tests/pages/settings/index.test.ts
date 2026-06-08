import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SettingsIndex from "~/pages/settings/index.vue";

describe("settings/index page", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects to /settings/feeds", () => {
    shallowMount(SettingsIndex);
    expect(navigateTo).toHaveBeenCalledWith("/settings/feeds", {
      replace: true,
    });
  });
});
