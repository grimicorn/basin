// Configurable so e2e tests can point these at a local mock server.
// Set TWITTER_TOKEN_URL / TWITTER_USER_URL in the environment to override.
const TWITTER_TOKEN_URL =
  process.env.TWITTER_TOKEN_URL ?? "https://api.twitter.com/2/oauth2/token";
const TWITTER_USER_URL =
  process.env.TWITTER_USER_URL ??
  "https://api.twitter.com/2/users/me?user.fields=username,id";

const TWITTER_SCOPES = [
  "tweet.read",
  "users.read",
  "follows.read",
  "offline.access",
].join(" ");

export function buildTwitterAuthUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string {
  const { twitterClientId } = useRuntimeConfig();
  const params = new URLSearchParams({
    client_id: twitterClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: TWITTER_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "plain",
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

export interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope: string;
  token_type: string;
}

export interface TwitterUserInfo {
  userId: string;
  username: string;
}

export async function exchangeTwitterCodeForTokens(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TwitterTokenResponse> {
  const { twitterClientId, twitterClientSecret } = useRuntimeConfig();
  const credentials = Buffer.from(
    `${twitterClientId}:${twitterClientSecret}`,
  ).toString("base64");
  const response = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  return response.json() as Promise<TwitterTokenResponse>;
}

export async function getTwitterUserInfo(
  accessToken: string,
): Promise<TwitterUserInfo> {
  const response = await fetch(TWITTER_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as {
    data?: { id?: string; username?: string };
  };
  const userId = data.data?.id ?? "";
  const username = data.data?.username ? `@${data.data.username}` : "";
  return { userId, username };
}
