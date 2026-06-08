import { eq } from "drizzle-orm";
import { integrations } from "../db/schema";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  return useDb().query.integrations.findMany({
    where: eq(integrations.userId, user.id),
    columns: {
      accessToken: false,
      refreshToken: false,
      tokenSecret: false,
    },
  });
});
