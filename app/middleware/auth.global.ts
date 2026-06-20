const PUBLIC_PATHS = ["/", "/pricing"];

export default defineNuxtRouteMiddleware((to) => {
  const { isSignedIn } = useAuth();

  if (isSignedIn.value && (to.path === "/" || to.path === "/login")) {
    return navigateTo("/dashboard");
  }

  if (
    !isSignedIn.value &&
    !PUBLIC_PATHS.includes(to.path) &&
    to.path !== "/login"
  ) {
    return navigateTo("/login");
  }
});
