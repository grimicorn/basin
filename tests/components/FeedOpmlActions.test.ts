import { describe, it, expect, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import FeedOpmlActions from "~/components/FeedOpmlActions.vue";

function mountActions(props = {}) {
  return shallowMount(FeedOpmlActions, { props });
}

describe("FeedOpmlActions", () => {
  it("triggers the hidden file input when Import OPML is clicked", async () => {
    const wrapper = mountActions();
    const fileInput = wrapper.find(".opml-file-input");
    const clickSpy = vi.spyOn(fileInput.element, "click");

    const importButtons = wrapper
      .findAll("button")
      .filter((button) => button.text().includes("Import OPML"));
    await importButtons[0].trigger("click");

    expect(clickSpy).toHaveBeenCalled();
  });

  it("emits import-file with the selected file", async () => {
    const wrapper = mountActions();
    const file = new File(["<opml></opml>"], "feeds.opml", {
      type: "text/x-opml",
    });
    const fileInput = wrapper.find(".opml-file-input");

    Object.defineProperty(fileInput.element, "files", {
      value: [file],
      configurable: true,
    });
    await fileInput.trigger("change");

    expect(wrapper.emitted("import-file")).toEqual([[file]]);
  });

  it("does not emit import-file when no file is selected", async () => {
    const wrapper = mountActions();
    const fileInput = wrapper.find(".opml-file-input");

    Object.defineProperty(fileInput.element, "files", {
      value: [],
      configurable: true,
    });
    await fileInput.trigger("change");

    expect(wrapper.emitted("import-file")).toBeUndefined();
  });

  it("clears the file input value after selection so re-picking the same file re-fires change", async () => {
    const wrapper = mountActions();
    const file = new File(["<opml></opml>"], "feeds.opml");
    const fileInput = wrapper.find(".opml-file-input");

    Object.defineProperty(fileInput.element, "files", {
      value: [file],
      configurable: true,
    });
    await fileInput.trigger("change");

    expect((fileInput.element as HTMLInputElement).value).toBe("");
  });

  it("emits export when Export OPML is clicked", async () => {
    const wrapper = mountActions();
    const exportButtons = wrapper
      .findAll("button")
      .filter((button) => button.text().includes("Export OPML"));
    await exportButtons[0].trigger("click");

    expect(wrapper.emitted("export")).toHaveLength(1);
  });

  it("shows Importing… on the import button while importing", () => {
    const wrapper = mountActions({ importing: true });
    expect(wrapper.text()).toContain("Importing…");
  });

  it("disables the import button while importing", () => {
    const wrapper = mountActions({ importing: true });
    const importButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Importing"));
    expect(importButton.attributes("disabled")).toBeDefined();
  });

  it("shows Exporting… on the export button while exporting", () => {
    const wrapper = mountActions({ exporting: true });
    expect(wrapper.text()).toContain("Exporting…");
  });

  it("disables the export button while exporting", () => {
    const wrapper = mountActions({ exporting: true });
    const exportButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Exporting"));
    expect(exportButton.attributes("disabled")).toBeDefined();
  });

  it("shows the import summary after a successful import", () => {
    const wrapper = mountActions({
      importSummary: { importedCount: 3, skipped: [] },
    });
    expect(wrapper.find(".opml-summary").text()).toContain("Imported 3 feeds");
  });

  it("uses singular 'feed' when exactly one feed was imported", () => {
    const wrapper = mountActions({
      importSummary: { importedCount: 1, skipped: [] },
    });
    expect(wrapper.find(".opml-summary").text()).toContain("Imported 1 feed");
    expect(wrapper.find(".opml-summary").text()).not.toContain("1 feeds");
  });

  it("lists skipped entries in the import summary", () => {
    const wrapper = mountActions({
      importSummary: {
        importedCount: 1,
        skipped: [
          {
            url: "https://bad.example.com/feed.xml",
            title: "Bad Feed",
            reason: "URL does not point to a valid RSS or Atom feed",
          },
        ],
      },
    });
    expect(wrapper.find(".opml-summary").text()).toContain("skipped 1");
    expect(wrapper.find(".opml-summary").text()).toContain("Bad Feed");
  });

  it("falls back to the URL for a skipped entry with no title", () => {
    const wrapper = mountActions({
      importSummary: {
        importedCount: 0,
        skipped: [
          {
            url: "https://bad.example.com/feed.xml",
            title: null,
            reason: "invalid",
          },
        ],
      },
    });
    expect(wrapper.find(".opml-summary").text()).toContain(
      "https://bad.example.com/feed.xml",
    );
  });

  it("hides the import summary when there is none", () => {
    const wrapper = mountActions({ importSummary: null });
    expect(wrapper.find(".opml-summary").exists()).toBe(false);
  });

  it("matches snapshot in the default state", () => {
    const wrapper = mountActions();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot with an import summary", () => {
    const wrapper = mountActions({
      importSummary: {
        importedCount: 2,
        skipped: [
          {
            url: "https://bad.example.com/feed.xml",
            title: "Bad Feed",
            reason: "invalid",
          },
        ],
      },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
