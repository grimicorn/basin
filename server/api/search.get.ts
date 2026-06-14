import { searchFeedItems } from "../utils/search";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const { q } = getQuery(event);
  const query = typeof q === "string" ? q.trim() : "";
  if (!query)
    throw createError({ statusCode: 400, statusMessage: "Query is required" });

  return searchFeedItems(user.id, query);
});
