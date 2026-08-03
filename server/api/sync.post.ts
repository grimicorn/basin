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

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: `payload.${field} must be a boolean`,
    });
  }
  return value;
}

// Absent (undefined/null) values fall back to the handler's default; any other
// value must parse to a real date, otherwise it would persist as Invalid Date.
function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw createError({
      statusCode: 400,
      statusMessage: `payload.${field} must be a valid date`,
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `payload.${field} must be a valid date`,
    });
  }
  return date;
}

async function applyMarkRead(db: SyncDb, payload: SyncPayload) {
  const readAt = parseOptionalDate(payload.readAt, "readAt") ?? new Date();
  await db.update(feedItems).set({ readAt }).where(buildFeedItemWhere(payload));
}

async function applyStar(db: SyncDb, payload: SyncPayload) {
  const starred = assertBoolean(payload.starred, "starred");
  await db
    .update(feedItems)
    .set({ starred })
    .where(buildFeedItemWhere(payload));
}

async function applySave(db: SyncDb, payload: SyncPayload) {
  const savedAt = parseOptionalDate(payload.savedAt, "savedAt");
  await db
    .update(feedItems)
    .set({ savedAt })
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

  const guid = payload.guid;
  if (typeof guid !== "string" || guid.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "payload.guid must be a non-empty string",
    });
  }

  const db = useDb();
  await assertUserOwnsFeed(db, feedId, user.id);
  await handler(db, payload);
  return { ok: true };
});
