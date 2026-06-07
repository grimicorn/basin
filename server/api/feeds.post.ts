import { feeds } from "../db/schema";

function detectSource(url: string): string {
  return /podcast|simplecast|megaphone|\.mp3|audio/i.test(url)
    ? "podcast"
    : "rss";
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const { url } = await readBody<{ url: string }>(event);
  if (!url?.trim())
    throw createError({ statusCode: 400, statusMessage: "URL is required" });

  const [feed] = await useDb()
    .insert(feeds)
    .values({
      userId: user.id,
      url: url.trim(),
      source: detectSource(url.trim()),
    })
    .returning();

  return feed;
});
