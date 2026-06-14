import { feeds } from "../db/schema";
import { validateFeedContent } from "../utils/feedValidator";

const FEED_VALIDATION_TIMEOUT_MS = 10_000;

function detectSource(url: string): string {
  return /podcast|simplecast|megaphone|\.mp3|audio/i.test(url)
    ? "podcast"
    : "rss";
}

async function validateWithTimeout(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    FEED_VALIDATION_TIMEOUT_MS,
  );

  try {
    const boundFetch = (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => fetch(input, { ...init, signal: controller.signal });

    return await validateFeedContent(url, boundFetch as typeof fetch);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const { url } = await readBody<{ url: string }>(event);
  if (!url?.trim())
    throw createError({ statusCode: 400, statusMessage: "URL is required" });

  const trimmedUrl = url.trim();

  let isValid: boolean;
  try {
    isValid = await validateWithTimeout(trimmedUrl);
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    throw createError({
      statusCode: isTimeout ? 504 : 422,
      statusMessage: isTimeout
        ? "Feed validation timed out"
        : "URL does not point to a valid RSS or Atom feed",
    });
  }

  if (!isValid)
    throw createError({
      statusCode: 422,
      statusMessage: "URL does not point to a valid RSS or Atom feed",
    });

  const [feed] = await useDb()
    .insert(feeds)
    .values({
      userId: user.id,
      url: trimmedUrl,
      source: detectSource(trimmedUrl),
    })
    .returning();

  return feed;
});
