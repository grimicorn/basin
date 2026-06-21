import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import AppAlert from "~/components/AppAlert.vue";

describe("AppAlert", () => {
  it("renders the correct theme class", () => {
    const wrapper = shallowMount(AppAlert, { props: { theme: "info" } });
    expect(wrapper.classes()).toContain("info");
  });

  it("renders title when provided and not compact", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "success", title: "All done" },
    });
    expect(wrapper.find(".alert-title").text()).toBe("All done");
  });

  it("omits title in compact mode", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "success", title: "All done", compact: true },
    });
    expect(wrapper.find(".alert-title").exists()).toBe(false);
  });

  it("renders slot content as message", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "warning" },
      slots: { default: "Something went wrong." },
    });
    expect(wrapper.find(".alert-msg").text()).toContain(
      "Something went wrong.",
    );
  });

  it("renders message prop when no slot", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "error", message: "Connection failed." },
    });
    expect(wrapper.find(".alert-msg").text()).toContain("Connection failed.");
  });

  it("shows dismiss button when dismissible", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "info", dismissible: true },
    });
    expect(wrapper.find(".alert-x").exists()).toBe(true);
  });

  it("hides dismiss button when not dismissible", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "info", dismissible: false },
    });
    expect(wrapper.find(".alert-x").exists()).toBe(false);
  });

  it("emits dismiss when X is clicked", async () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "info", dismissible: true },
    });
    await wrapper.find(".alert-x").trigger("click");
    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });

  it("applies compact class", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "success", compact: true },
    });
    expect(wrapper.classes()).toContain("compact");
  });

  it.each(["info", "success", "warning", "error"] as const)(
    "matches snapshot — theme=%s",
    (theme) => {
      const wrapper = shallowMount(AppAlert, {
        props: { theme, title: "Title", message: "Body text." },
      });
      expect(wrapper.html()).toMatchSnapshot();
    },
  );

  it("matches snapshot — compact", () => {
    const wrapper = shallowMount(AppAlert, {
      props: { theme: "info", message: "A compact note.", compact: true },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — dismissible", () => {
    const wrapper = shallowMount(AppAlert, {
      props: {
        theme: "warning",
        title: "Heads up",
        message: "Dismissible alert.",
        dismissible: true,
      },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
