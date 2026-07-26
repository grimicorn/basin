import { desc, eq } from "drizzle-orm";
import { feeds } from "../../db/schema";
import { serializeOpml } from "../../utils/opml";

const OPML_FILENAME = "feeds.opml";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userFeeds = await useDb().query.feeds.findMany({
    where: eq(feeds.userId, user.id),
    orderBy: [desc(feeds.createdAt)],
  });

  setHeader(event, "Content-Type", "text/x-opml; charset=utf-8");
  setHeader(
    event,
    "Content-Disposition",
    `attachment; filename="${OPML_FILENAME}"`,
  );

  return serializeOpml(
    userFeeds.map((feed) => ({ url: feed.url, title: feed.title })),
  );
});
