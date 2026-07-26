import { createFeedForUser, type FeedSource } from "../utils/feedCreation";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ url: string; sourceOverride?: FeedSource }>(
    event,
  );
  const { sourceOverride } = body;

  if (
    sourceOverride !== undefined &&
    sourceOverride !== "rss" &&
    sourceOverride !== "podcast"
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid sourceOverride value",
    });
  }

  if (!body.url?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "URL is required" });
  }

  return createFeedForUser(user.id, body.url.trim(), sourceOverride);
});
