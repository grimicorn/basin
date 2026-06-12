import { discoverFeedUrl } from "../../utils/feedDiscovery";
import { validateFeedUrl } from "../../utils/urlValidator";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const { url } = await readBody<{ url: string }>(event);
  if (!url?.trim())
    throw createError({ statusCode: 400, statusMessage: "URL is required" });

  const validatedUrl = await validateFeedUrl(url.trim());

  const feedUrl = await discoverFeedUrl(validatedUrl);
  if (!feedUrl)
    throw createError({
      statusCode: 422,
      statusMessage: "No feed found at the given URL",
    });

  return { feedUrl };
});
