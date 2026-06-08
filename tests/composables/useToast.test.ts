import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useToast } from "~/composables/useToast";

const { toast, showToast } = useToast();

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toast.show = false;
    toast.msg = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows toast with the given message", () => {
    showToast("Hello world");
    expect(toast.show).toBe(true);
    expect(toast.msg).toBe("Hello world");
  });

  it("hides toast after 2200ms", () => {
    showToast("Hello");
    vi.advanceTimersByTime(2200);
    expect(toast.show).toBe(false);
  });

  it("stays visible before 2200ms", () => {
    showToast("Hello");
    vi.advanceTimersByTime(2199);
    expect(toast.show).toBe(true);
  });

  it("resets timer on rapid calls", () => {
    showToast("First");
    vi.advanceTimersByTime(1000);
    showToast("Second");
    expect(toast.msg).toBe("Second");
    vi.advanceTimersByTime(1000);
    // Only 1000ms since the second call — still visible
    expect(toast.show).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(toast.show).toBe(false);
  });
});
