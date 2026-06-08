import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import AppToast from "~/components/AppToast.vue";
import { useToast } from "~/composables/useToast";

const { toast } = useToast();

describe("AppToast", () => {
  beforeEach(() => {
    toast.show = false;
    toast.msg = "";
  });

  it("renders nothing when toast is hidden", () => {
    toast.show = false;
    const wrapper = shallowMount(AppToast);
    expect(wrapper.find(".toast").exists()).toBe(false);
  });

  it("renders toast message when visible", async () => {
    const wrapper = shallowMount(AppToast);
    toast.show = true;
    toast.msg = "Saved for later";
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".toast").exists()).toBe(true);
    expect(wrapper.find(".toast").text()).toContain("Saved for later");
  });

  it("matches snapshot (hidden)", () => {
    toast.show = false;
    const wrapper = shallowMount(AppToast);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot (visible)", async () => {
    const wrapper = shallowMount(AppToast);
    toast.show = true;
    toast.msg = "Feed added";
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatchSnapshot();
  });
});
