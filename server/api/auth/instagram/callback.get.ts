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
  accountId: string,
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
      providerAccountId: accountId,
      providerUsername: username,
    })
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: {
        accessToken,
        expiresAt,
        scopes: INSTAGRAM_SCOPES_LIST,
        providerAccountId: accountId,
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
  const cookieState = getCookie(event, "oauth_state_instagram");

  validateOAuthCallback(code, state, cookieState);
  deleteCookie(event, "oauth_state_instagram");

  const { origin } = getRequestURL(event);
  const redirectUri = `${origin}/api/auth/instagram/callback`;

  const tokenResponse = await exchangeInstagramCode(String(code), redirectUri);

  if (tokenResponse.error) {
    throw createError({
      statusCode: 502,
      statusMessage: `Instagram token exchange failed: ${tokenResponse.error.message}`,
    });
  }

  // userInfo.id is the stable Instagram user ID returned by the Basic Display
  // API's /me endpoint. We use this directly as providerAccountId.
  // The Graph API's /me/accounts route (which traverses page → instagram_business_account)
  // is only relevant for Business/Creator accounts using the Graph API — it does
  // not exist on the Basic Display API, which is what this integration uses.
  const userInfo = await getInstagramUserInfo(tokenResponse.access_token);
  await upsertInstagramIntegration(
    event.context.user.id,
    tokenResponse.access_token,
    userInfo.id,
    userInfo.username,
  );

  return sendRedirect(event, "/settings/connections");
});
