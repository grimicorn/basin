import { integrations } from "../../../db/schema";
import { SYNC_STATUS } from "../../../utils/syncStatus";

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const { code, state } = getQuery(event);
  const cookieState = getCookie(event, "oauth_state_youtube");

  if (!code || !state || state !== cookieState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth state",
    });
  }

  deleteCookie(event, "oauth_state_youtube");

  const { origin } = getRequestURL(event);
  const redirectUri = `${origin}/api/auth/youtube/callback`;

  const tokens = await exchangeCodeForTokens(String(code), redirectUri);
  const handle = await getYouTubeChannelHandle(tokens.access_token);

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const db = useDb();
  await db
    .insert(integrations)
    .values({
      userId: event.context.user.id,
      provider: "youtube",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      scopes: tokens.scope.split(" "),
      providerUsername: handle,
    })
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scopes: tokens.scope.split(" "),
        providerUsername: handle,
        // A successful (re)connect clears any stale "needs reconnect" state
        // immediately, rather than waiting for the next scheduled sync.
        syncStatus: SYNC_STATUS.OK,
        syncError: null,
        syncFailedAt: null,
        updatedAt: new Date(),
      },
    });

  return sendRedirect(event, "/settings/connections");
});
