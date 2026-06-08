import { desc, eq } from "drizzle-orm";
import { feeds } from "../db/schema";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  return useDb().query.feeds.findMany({
    where: eq(feeds.userId, user.id),
    orderBy: [desc(feeds.createdAt)],
  });
});
