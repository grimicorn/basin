import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import SettingsConnections from "~/components/SettingsConnections.vue";
import { makeConnection } from "../fixtures";

const connected = makeConnection({
  id: "youtube",
  name: "YouTube",
  connected: true,
  account: "@mychannel",
  since: "Connected Jan 2024",
});
const disconnected = makeConnection({
  id: "twitter",
  name: "X / Twitter",
  connected: false,
});

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockLoad = vi.fn();

function stubConnections(
  connections = [connected, disconnected],
  opts: { loading?: boolean; error?: string | null } = {},
) {
  vi.stubGlobal("useConnections", () => ({
    items: ref(connections),
    loading: ref(opts.loading ?? false),
    error: ref(opts.error ?? null),
    load: mockLoad,
    connect: mockConnect,
    disconnect: mockDisconnect,
  }));
}

describe("SettingsConnections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    stubConnections();
  });

  it("renders a card for each connection", () => {
    const wrapper = shallowMount(SettingsConnections);
    expect(wrapper.findAll(".conn")).toHaveLength(2);
  });

  it("shows Disconnect for connected accounts", () => {
    const wrapper = shallowMount(SettingsConnections);
    const buttons = wrapper.findAll("button.btn");
    expect(buttons[0].text()).toBe("Disconnect");
  });

  it("shows Connect for disconnected accounts", () => {
    const wrapper = shallowMount(SettingsConnections);
    const buttons = wrapper.findAll("button.btn");
    expect(buttons[1].text()).toBe("Connect");
  });

  it("calls disconnect when button is clicked for a connected account", async () => {
    const wrapper = shallowMount(SettingsConnections);
    await wrapper.findAll("button.btn")[0].trigger("click");
    expect(mockDisconnect).toHaveBeenCalledWith(connected.id);
  });

  it("calls connect when button is clicked for a disconnected account", async () => {
    const wrapper = shallowMount(SettingsConnections);
    await wrapper.findAll("button.btn")[1].trigger("click");
    expect(mockConnect).toHaveBeenCalledWith(disconnected.id);
  });

  it("shows a live dot for connected accounts", () => {
    const wrapper = shallowMount(SettingsConnections);
    expect(wrapper.find(".live").exists()).toBe(true);
  });

  it("shows an error message when error is set", () => {
    stubConnections(undefined, { error: "Failed to load connections" });
    const wrapper = shallowMount(SettingsConnections);
    expect(wrapper.find(".conn-error").exists()).toBe(true);
    expect(wrapper.find(".conn-error").text()).toContain("Failed to load");
  });

  it("disables buttons when loading", () => {
    stubConnections(undefined, { loading: true });
    const wrapper = shallowMount(SettingsConnections);
    const buttons = wrapper.findAll("button.btn");
    buttons.forEach((btn) => expect(btn.attributes("disabled")).toBeDefined());
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(SettingsConnections);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
