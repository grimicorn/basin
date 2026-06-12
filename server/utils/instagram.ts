// Configurable so e2e tests can point these at a local mock server.
// Set INSTAGRAM_TOKEN_URL in the environment to override.
const INSTAGRAM_TOKEN_URL =
  process.env.INSTAGRAM_TOKEN_URL ??
  "https://graph.facebook.com/v19.0/oauth/access_token";

const INSTAGRAM_USER_URL =
  process.env.INSTAGRAM_USER_URL ??
  "https://graph.facebook.com/v19.0/me?fields=id,username&access_token=";

const INSTAGRAM_SCOPES = ["instagram_basic", "pages_show_list"].join(",");

export function buildInstagramAuthUrl(
  redirectUri: string,
  state: string,
): string {
  const { instagramClientId } = useRuntimeConfig();
  const params = new URLSearchParams({
    client_id: instagramClientId,
    redirect_uri: redirectUri,
    scope: INSTAGRAM_SCOPES,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
}

export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  error?: { message: string };
}

export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InstagramTokenResponse> {
  const { instagramClientId, instagramClientSecret } = useRuntimeConfig();
  const response = await fetchImpl(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: instagramClientId,
      client_secret: instagramClientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    }),
  });
  return response.json() as Promise<InstagramTokenResponse>;
}

export interface InstagramUserInfo {
  id: string;
  username: string;
}

export async function getInstagramUserInfo(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InstagramUserInfo> {
  const response = await fetchImpl(`${INSTAGRAM_USER_URL}${accessToken}`);
  const data = (await response.json()) as {
    id?: string;
    username?: string;
    error?: { message: string };
  };
  return {
    id: data.id ?? "",
    username: data.username ?? data.id ?? "",
  };
}
