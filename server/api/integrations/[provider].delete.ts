import { and, eq } from "drizzle-orm";
import { integrations } from "../../db/schema";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const provider = getRouterParam(event, "provider");
  if (!provider)
    throw createError({
      statusCode: 400,
      statusMessage: "Provider is required",
    });

  await useDb()
    .delete(integrations)
    .where(
      and(
        eq(integrations.userId, user.id),
        eq(integrations.provider, provider),
      ),
    );

  return { ok: true };
});
