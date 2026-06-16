import { and, eq } from "drizzle-orm";
import type { useDb } from "../db/index";
import { feedItems, feeds } from "../db/schema";

type SyncPayload = Record<string, unknown>;
type SyncDb = ReturnType<typeof useDb>;
type SyncHandler = (_db: SyncDb, _payload: SyncPayload) => Promise<void>;

function buildFeedItemWhere(payload: SyncPayload) {
  return and(
    eq(feedItems.feedId, payload.feedId as number),
    eq(feedItems.guid, payload.guid as string),
  );
}

async function applyMarkRead(db: SyncDb, payload: SyncPayload) {
  await db
    .update(feedItems)
    .set({
      readAt: payload.readAt ? new Date(payload.readAt as string) : new Date(),
    })
    .where(buildFeedItemWhere(payload));
}

async function applyStar(db: SyncDb, payload: SyncPayload) {
  await db
    .update(feedItems)
    .set({ starred: payload.starred as boolean })
    .where(buildFeedItemWhere(payload));
}

async function applySave(db: SyncDb, payload: SyncPayload) {
  await db
    .update(feedItems)
    .set({
      savedAt: payload.savedAt ? new Date(payload.savedAt as string) : null,
    })
    .where(buildFeedItemWhere(payload));
}

const syncHandlers: Record<string, SyncHandler> = {
  markRead: applyMarkRead,
  star: applyStar,
  save: applySave,
};

async function assertUserOwnsFeed(
  db: SyncDb,
  feedId: number,
  userId: number,
): Promise<void> {
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
    columns: { id: true },
  });

  if (!feed) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const { action, payload } = await readBody<{
    action: string;
    payload: SyncPayload;
  }>(event);

  const handler = syncHandlers[action];
  if (!handler) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown sync action: ${action}`,
    });
  }

  const feedId = payload.feedId;
  if (typeof feedId !== "number" || !Number.isInteger(feedId) || feedId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "payload.feedId must be a positive integer",
    });
  }

  const db = useDb();
  await assertUserOwnsFeed(db, feedId, user.id);
  await handler(db, payload);
  return { ok: true };
});
