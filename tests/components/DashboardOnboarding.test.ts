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
const mockConnectBluesky = vi.fn();
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

function stubConnections(connections = [ytConn, bsConn], overrides = {}) {
  vi.stubGlobal("useConnections", () => ({
    items: ref(connections),
    loading: ref(false),
    error: ref(null),
    connect: mockConnect,
    connectBluesky: mockConnectBluesky,
    load: vi.fn(),
    ...overrides,
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

  it("submits the feed form via button click", async () => {
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.find("form").trigger("submit");
    expect(mockAdd).toHaveBeenCalledOnce();
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

  it("calls connect(id) when YouTube Connect is clicked", async () => {
    const wrapper = shallowMount(DashboardOnboarding);
    const ytCard = wrapper.findAll(".ob-src")[0];
    await ytCard.find(".connect").trigger("click");
    expect(mockConnect).toHaveBeenCalledWith("youtube");
  });

  it("shows Bluesky form instead of calling connect when Bluesky Connect is clicked", async () => {
    const wrapper = shallowMount(DashboardOnboarding);
    const bsCard = wrapper.findAll(".ob-src")[1];
    await bsCard.find(".connect").trigger("click");
    expect(mockConnect).not.toHaveBeenCalled();
    expect(wrapper.find(".bluesky-form").exists()).toBe(true);
  });

  it("hides Bluesky form when Cancel is clicked", async () => {
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.findAll(".ob-src")[1].find(".connect").trigger("click");
    expect(wrapper.find(".bluesky-form").exists()).toBe(true);
    await wrapper.find(".bluesky-actions .btn:last-child").trigger("click");
    expect(wrapper.find(".bluesky-form").exists()).toBe(false);
  });

  it("calls connectBluesky with handle and password on form submit", async () => {
    mockConnectBluesky.mockResolvedValue(undefined);
    const inputStub = {
      props: ["modelValue", "id", "label", "type", "placeholder", "disabled"],
      emits: ["update:modelValue"],
      template:
        '<input :id="id" :type="type ?? \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    };
    const wrapper = shallowMount(DashboardOnboarding, {
      global: { stubs: { InputText: inputStub } },
    });
    await wrapper.findAll(".ob-src")[1].find(".connect").trigger("click");
    await wrapper.find("#ob-bsky-handle").setValue("you.bsky.social");
    await wrapper.find("#ob-bsky-password").setValue("xxxx-xxxx-xxxx-xxxx");
    await wrapper.find(".bluesky-actions .btn-primary").trigger("click");
    await wrapper.vm.$nextTick();
    expect(mockConnectBluesky).toHaveBeenCalledWith(
      "you.bsky.social",
      "xxxx-xxxx-xxxx-xxxx",
    );
  });

  it("emits feed-added after a successful add", async () => {
    mockAdd.mockResolvedValue(undefined);
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("feed-added")).toBeTruthy();
  });

  it("does not emit feed-added when add results in an error", async () => {
    stubFeeds({ error: ref("Something went wrong"), add: mockAdd });
    const wrapper = shallowMount(DashboardOnboarding);
    await wrapper.find("form").trigger("submit");
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
