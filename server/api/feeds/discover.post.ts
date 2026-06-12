import { discoverFeedUrl } from "../../utils/feedDiscovery";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const { url } = await readBody<{ url: string }>(event);
  if (!url?.trim())
    throw createError({ statusCode: 400, statusMessage: "URL is required" });

  const feedUrl = await discoverFeedUrl(url.trim());
  if (!feedUrl)
    throw createError({
      statusCode: 422,
      statusMessage: "No feed found at the given URL",
    });

  return { feedUrl };
});
