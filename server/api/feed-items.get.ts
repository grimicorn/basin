import { fetchFeedItems } from "../utils/feedItems";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const query = getQuery(event);

  function parseIntOrUndefined(value: unknown): number | undefined {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
      return undefined;
    }
    return Number.parseInt(value, 10);
  }

  const limit = parseIntOrUndefined(query.limit);
  const offset = parseIntOrUndefined(query.offset);

  return fetchFeedItems(user.id, { limit, offset });
});
