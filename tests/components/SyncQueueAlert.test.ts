import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import SyncQueueAlert from "~/components/SyncQueueAlert.vue";
import AppAlert from "~/components/AppAlert.vue";

const mockFailedCount = ref(0);
const mockRefreshFailedCount = vi.fn().mockResolvedValue(undefined);
const mockRetryFailedItems = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal("useSyncQueue", () => ({
  failedCount: mockFailedCount,
  refreshFailedCount: mockRefreshFailedCount,
  retryFailedItems: mockRetryFailedItems,
  queueAction: vi.fn(),
  flushSyncQueue: vi.fn(),
}));

describe("SyncQueueAlert", () => {
  beforeEach(() => {
    mockFailedCount.value = 0;
    mockRefreshFailedCount.mockClear();
    mockRetryFailedItems.mockClear();
  });

  it("renders nothing when there are no failed items", () => {
    const wrapper = shallowMount(SyncQueueAlert);
    expect(wrapper.find(".sync-queue-alert").exists()).toBe(false);
  });

  it("refreshes the failed count on mount", () => {
    shallowMount(SyncQueueAlert);
    expect(mockRefreshFailedCount).toHaveBeenCalled();
  });

  it("renders a warning banner with plural phrasing for multiple failed items", async () => {
    const wrapper = shallowMount(SyncQueueAlert);
    mockFailedCount.value = 2;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".sync-queue-alert").exists()).toBe(true);
    expect(wrapper.html()).toContain("2 offline actions");
  });

  it("uses singular phrasing for exactly one failed item", async () => {
    const wrapper = shallowMount(SyncQueueAlert);
    mockFailedCount.value = 1;
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toContain("1 offline action couldn't");
  });

  // These three exercise the real AppAlert (its actions/dismiss slot content
  // is invisible behind the default shallow stub), so render it for real.
  const mountWithRealAppAlert = () =>
    shallowMount(SyncQueueAlert, {
      global: { stubs: { AppAlert: false }, components: { AppAlert } },
    });

  it("clicking retry now calls retryFailedItems", async () => {
    const wrapper = mountWithRealAppAlert();
    mockFailedCount.value = 2;
    await wrapper.vm.$nextTick();
    await wrapper.find(".sync-queue-alert-retry").trigger("click");
    expect(mockRetryFailedItems).toHaveBeenCalledTimes(1);
  });

  it("hides the banner once dismissed", async () => {
    const wrapper = mountWithRealAppAlert();
    mockFailedCount.value = 2;
    await wrapper.vm.$nextTick();
    await wrapper.find(".alert-x").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".sync-queue-alert").exists()).toBe(false);
  });

  it("re-surfaces a dismissed banner once more items fail", async () => {
    const wrapper = mountWithRealAppAlert();
    mockFailedCount.value = 2;
    await wrapper.vm.$nextTick();
    await wrapper.find(".alert-x").trigger("click");
    await wrapper.vm.$nextTick();
    mockFailedCount.value = 3;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".sync-queue-alert").exists()).toBe(true);
  });

  it("matches snapshot (hidden)", () => {
    const wrapper = shallowMount(SyncQueueAlert);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (visible)", async () => {
    const wrapper = shallowMount(SyncQueueAlert);
    mockFailedCount.value = 3;
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });
});
