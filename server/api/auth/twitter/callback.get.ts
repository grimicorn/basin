import { integrations } from "../../../db/schema";

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const { code, state } = getQuery(event);
  const cookieState = getCookie(event, "oauth_state");
  const codeVerifier = getCookie(event, "twitter_code_verifier");

  if (!code || !state || state !== cookieState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth state",
    });
  }

  if (!codeVerifier) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing code verifier",
    });
  }

  deleteCookie(event, "oauth_state");
  deleteCookie(event, "twitter_code_verifier");

  const { origin } = getRequestURL(event);
  const redirectUri = `${origin}/api/auth/twitter/callback`;

  const tokens = await exchangeTwitterCodeForTokens(
    String(code),
    redirectUri,
    codeVerifier,
  );

  const { userId, username } = await getTwitterUserInfo(tokens.access_token);

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  const db = useDb();
  await db
    .insert(integrations)
    .values({
      userId: event.context.user.id,
      provider: "twitter",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      scopes: tokens.scope.split(" "),
      providerAccountId: userId,
      providerUsername: username,
    })
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes: tokens.scope.split(" "),
        providerAccountId: userId,
        providerUsername: username,
        updatedAt: new Date(),
      },
    });

  return sendRedirect(event, "/settings/connections");
});
