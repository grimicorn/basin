import { and, eq } from "drizzle-orm";
import { feeds } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const id = Number(getRouterParam(event, "id"));
  if (!id)
    throw createError({ statusCode: 400, statusMessage: "Invalid feed ID" });

  const deleted = await useDb()
    .delete(feeds)
    .where(and(eq(feeds.id, id), eq(feeds.userId, user.id)))
    .returning({ id: feeds.id });

  if (!deleted.length)
    throw createError({ statusCode: 404, statusMessage: "Feed not found" });

  return { ok: true };
});
