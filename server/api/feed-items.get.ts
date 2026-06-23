import { fetchFeedItems } from "../utils/feedItems";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const query = getQuery(event);
  const limit =
    typeof query.limit === "string" ? parseInt(query.limit, 10) : undefined;
  const offset =
    typeof query.offset === "string" ? parseInt(query.offset, 10) : undefined;

  return fetchFeedItems(user.id, { limit, offset });
});
