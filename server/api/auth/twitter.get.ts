import { randomBytes } from "node:crypto";

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const state = randomBytes(32).toString("hex");
  const codeVerifier = randomBytes(32).toString("hex");

  setCookie(event, "oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
  });

  setCookie(event, "twitter_code_verifier", codeVerifier, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
  });

  const { origin } = getRequestURL(event);
  const redirectUri = `${origin}/api/auth/twitter/callback`;

  return sendRedirect(
    event,
    buildTwitterAuthUrl(redirectUri, state, codeVerifier),
  );
});
