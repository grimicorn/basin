import { randomBytes } from "node:crypto";

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const state = randomBytes(32).toString("hex");
  setCookie(event, "oauth_state_youtube", state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
  });

  const { origin } = getRequestURL(event);
  const redirectUri = `${origin}/api/auth/youtube/callback`;

  return sendRedirect(event, buildYouTubeAuthUrl(redirectUri, state));
});
