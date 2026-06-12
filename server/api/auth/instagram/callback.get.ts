import { integrations } from "../../../db/schema";

const INSTAGRAM_TOKEN_EXPIRY_DAYS = 60;
const INSTAGRAM_SCOPES_LIST = ["instagram_basic", "pages_show_list"];

function validateOAuthCallback(
  code: unknown,
  state: unknown,
  cookieState: string | undefined,
): void {
  if (!code || !state || state !== cookieState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid OAuth state",
    });
  }
}

function buildTokenExpiry(): Date {
  return new Date(
    Date.now() + INSTAGRAM_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );
}

async function upsertInstagramIntegration(
  userId: number,
  accessToken: string,
  username: string,
): Promise<void> {
  const database = useDb();
  const expiresAt = buildTokenExpiry();
  await database
    .insert(integrations)
    .values({
      userId,
      provider: "instagram",
      accessToken,
      expiresAt,
      scopes: INSTAGRAM_SCOPES_LIST,
      providerUsername: username,
    })
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: {
        accessToken,
        expiresAt,
        scopes: INSTAGRAM_SCOPES_LIST,
        providerUsername: username,
        updatedAt: new Date(),
      },
    });
}

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const { code, state } = getQuery(event);
  const cookieState = getCookie(event, "oauth_state");

  validateOAuthCallback(code, state, cookieState);
  deleteCookie(event, "oauth_state");

  const { origin } = getRequestURL(event);
  const redirectUri = `${origin}/api/auth/instagram/callback`;

  const tokenResponse = await exchangeInstagramCode(String(code), redirectUri);

  if (tokenResponse.error) {
    throw createError({
      statusCode: 502,
      statusMessage: `Instagram token exchange failed: ${tokenResponse.error.message}`,
    });
  }

  const username = await getInstagramUsername(tokenResponse.access_token);
  await upsertInstagramIntegration(
    event.context.user.id,
    tokenResponse.access_token,
    username,
  );

  return sendRedirect(event, "/settings/connections");
});
