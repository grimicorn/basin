import { discoverFeedUrl } from "../../utils/feedDiscovery";
import { validateFeedUrl } from "../../utils/urlValidator";

function parseUrlFromBody(body: unknown): string {
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>).url !== "string" ||
    !(body as { url: string }).url.trim()
  ) {
    throw createError({ statusCode: 400, statusMessage: "URL is required" });
  }
  return (body as { url: string }).url.trim();
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const url = parseUrlFromBody(await readBody(event));
  const validatedUrl = await validateFeedUrl(url);

  const feedUrl = await discoverFeedUrl(validatedUrl);
  if (!feedUrl)
    throw createError({
      statusCode: 422,
      statusMessage: "No feed found at the given URL",
    });

  return { feedUrl };
});
