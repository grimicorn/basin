import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";

const mockIsSignedIn = ref(false);
const mockNavigateTo = vi.fn();

vi.stubGlobal("useAuth", () => ({ isSignedIn: mockIsSignedIn }));
vi.stubGlobal("navigateTo", mockNavigateTo);

import authMiddleware from "~/middleware/auth.global";

describe("auth.global middleware", () => {
  beforeEach(() => {
    mockIsSignedIn.value = false;
    mockNavigateTo.mockClear();
  });

  it("redirects unauthenticated user to /login", () => {
    authMiddleware({ path: "/" } as any);
    expect(mockNavigateTo).toHaveBeenCalledWith("/login");
  });

  it("does not redirect unauthenticated user already on /login", () => {
    authMiddleware({ path: "/login" } as any);
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });

  it("redirects signed-in user from /login to /dashboard", () => {
    mockIsSignedIn.value = true;
    authMiddleware({ path: "/login" } as any);
    expect(mockNavigateTo).toHaveBeenCalledWith("/dashboard");
  });

  it("does not redirect signed-in user on other routes", () => {
    mockIsSignedIn.value = true;
    authMiddleware({ path: "/settings" } as any);
    expect(mockNavigateTo).not.toHaveBeenCalled();
  });
});
