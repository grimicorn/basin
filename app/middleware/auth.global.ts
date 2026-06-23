const PUBLIC_PATHS = ["/", "/pricing", "/about", "/privacy", "/contact"];

export default defineNuxtRouteMiddleware((to) => {
  const { isSignedIn } = useAuth();
  const path = to.path.replace(/(.)\/$/, "$1");

  if (isSignedIn.value && (path === "/" || path === "/login")) {
    return navigateTo("/dashboard");
  }

  if (!isSignedIn.value && !PUBLIC_PATHS.includes(path) && path !== "/login") {
    return navigateTo("/login");
  }
});
