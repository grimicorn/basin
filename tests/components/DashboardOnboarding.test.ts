import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import DashboardOnboarding from "~/components/DashboardOnboarding.vue";
import { makeConnection } from "../fixtures";

const ytConn = makeConnection({ id: "youtube", name: "YouTube" });
const bsConn = makeConnection({
  id: "bluesky",
  name: "Bluesky",
  color: "var(--src-tweet)",
});

const mockAdd = vi.fn();
const mockConnect = vi.fn();
const mockLoad = vi.fn();

function stubFeeds(overrides = {}) {
  vi.stubGlobal("useFeeds", () => ({
    newUrl: ref(""),
    isAdding: ref(false),
    discovering: ref(false),
    error: ref(null),
    add: mockAdd,
    load: mockLoad,
    ...overrides,
  }));
}

function stubConnections(connections = [ytConn, bsConn]) {
  vi.stubGlobal("useConnections", () => ({
    items: ref(connections),
    loading: ref(false),
    connect: mockConnect,
    load: vi.fn(),
  }));
}

describe("DashboardOnboarding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    stubFeeds();
    stubConnections();
  });

  it("renders the hero section", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.find(".ob-hero").exists()).toBe(true);
  });

  it("renders the hero headline", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.find(".ob-hero h1").text()).toBe(
      "Your feed is empty — let's fill it.",
    );
  });

  it("renders the RSS add card", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.find(".ob-card").exists()).toBe(true);
  });

  it("renders the add feed button", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.find(".ob-add-btn").exists()).toBe(true);
  });

  it("renders a connection card for each connection", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.findAll(".ob-src")).toHaveLength(2);
  });

  it("shows connection names", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    const names = wrapper.findAll(".ob-src .nm").map((el) => el.text());
    expect(names).toContain("YouTube");
    expect(names).toContain("Bluesky");
  });

  it("calls add when add feed button is clicked", async () => {
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.find(".ob-add-btn").trigger("click");
    expect(mockAdd).toHaveBeenCalledOnce();
  });

  it("calls connect with the connection id when Connect is clicked", async () => {
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.findAll(".ob-src .connect")[0].trigger("click");
    expect(mockConnect).toHaveBeenCalledWith("youtube");
  });

  it("emits feed-added after a successful add", async () => {
    mockAdd.mockResolvedValue(undefined);
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.find(".ob-add-btn").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("feed-added")).toBeTruthy();
  });

  it("does not emit feed-added when add results in an error", async () => {
    vi.stubGlobal("useFeeds", () => ({
      newUrl: ref(""),
      isAdding: ref(false),
      discovering: ref(false),
      error: ref("Something went wrong"),
      add: mockAdd,
      load: mockLoad,
    }));
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.find(".ob-add-btn").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("feed-added")).toBeFalsy();
  });

  it("renders the getting-started steps", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.findAll(".ob-step")).toHaveLength(3);
  });

  it("marks the first step as active", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.findAll(".ob-step")[0].classes()).toContain("active");
  });

  it("matches snapshot", () => {
    const wrapper = shallowMount(DashboardOnboarding);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
