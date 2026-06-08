export default defineNuxtRouteMiddleware((to) => {
  const { isSignedIn } = useAuth();

  if (!isSignedIn.value && to.path !== "/login") {
    return navigateTo("/login");
  }

  if (isSignedIn.value && to.path === "/login") {
    return navigateTo("/dashboard");
  }
});
