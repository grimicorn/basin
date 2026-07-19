import { integrations } from "../../db/schema";
import { SYNC_STATUS } from "../../utils/syncStatus";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody(event);
  const handle = body?.handle?.trim();
  const appPassword = body?.appPassword?.trim();

  if (!handle || !appPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: "Handle and app password are required",
    });
  }

  let session;
  try {
    session = await createBlueskySession(handle, appPassword);
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid Bluesky handle or app password",
    });
  }

  const db = useDb();
  await db
    .insert(integrations)
    .values({
      userId: user.id,
      provider: "bluesky",
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt,
      // App password stored in tokenSecret so the sync worker can re-authenticate
      // when both the access and refresh JWTs have expired.
      tokenSecret: appPassword,
      providerAccountId: session.did,
      providerUsername: session.handle,
    })
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.provider],
      set: {
        accessToken: session.accessJwt,
        refreshToken: session.refreshJwt,
        tokenSecret: appPassword,
        providerAccountId: session.did,
        providerUsername: session.handle,
        // A successful (re)connect clears any stale "needs reconnect" state
        // immediately, rather than waiting for the next scheduled sync.
        syncStatus: SYNC_STATUS.OK,
        syncError: null,
        syncFailedAt: null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, handle: session.handle };
});
