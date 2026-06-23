import { fetchFeedItems } from "../utils/feedItems";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const query = getQuery(event);

  function parseIntOrUndefined(value: unknown): number | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  const limit = parseIntOrUndefined(query.limit);
  const offset = parseIntOrUndefined(query.offset);

  return fetchFeedItems(user.id, { limit, offset });
});
