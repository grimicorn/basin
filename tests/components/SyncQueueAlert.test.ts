import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import SyncQueueAlert from "~/components/SyncQueueAlert.vue";

const mockFailedCount = ref(0);
const mockRefreshFailedCount = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal("useSyncQueue", () => ({
  failedCount: mockFailedCount,
  refreshFailedCount: mockRefreshFailedCount,
  queueAction: vi.fn(),
  flushSyncQueue: vi.fn(),
}));

describe("SyncQueueAlert", () => {
  beforeEach(() => {
    mockFailedCount.value = 0;
    mockRefreshFailedCount.mockClear();
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
