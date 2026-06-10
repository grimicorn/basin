import { searchFeedItems } from "../utils/algolia";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const query = getQuery(event);
  const searchQuery = typeof query.q === "string" ? query.q.trim() : "";

  const hits = await searchFeedItems(searchQuery, user.id);
  return hits;
});
