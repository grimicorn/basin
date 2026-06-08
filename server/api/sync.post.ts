import { eq } from "drizzle-orm";
import type { useDb } from "../db/index";
import { feedItems } from "../db/schema";

type SyncPayload = Record<string, unknown>;
type SyncDb = ReturnType<typeof useDb>;
type SyncHandler = (_db: SyncDb, _payload: SyncPayload) => Promise<void>;

async function applyMarkRead(db: SyncDb, payload: SyncPayload) {
  await db
    .update(feedItems)
    .set({
      readAt: payload.readAt ? new Date(payload.readAt as string) : new Date(),
    })
    .where(eq(feedItems.guid, payload.guid as string));
}

async function applyStar(db: SyncDb, payload: SyncPayload) {
  await db
    .update(feedItems)
    .set({ starred: payload.starred as boolean })
    .where(eq(feedItems.guid, payload.guid as string));
}

async function applySave(db: SyncDb, payload: SyncPayload) {
  await db
    .update(feedItems)
    .set({
      savedAt: payload.savedAt ? new Date(payload.savedAt as string) : null,
    })
    .where(eq(feedItems.guid, payload.guid as string));
}

const syncHandlers: Record<string, SyncHandler> = {
  markRead: applyMarkRead,
  star: applyStar,
  save: applySave,
};

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const { action, payload } = await readBody<{
    action: string;
    payload: SyncPayload;
  }>(event);

  const handler = syncHandlers[action];
  if (!handler)
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown sync action: ${action}`,
    });

  await handler(useDb(), payload);
  return { ok: true };
});
