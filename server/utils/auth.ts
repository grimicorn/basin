import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { users } from "../db/schema";

export type DbUser = InferSelectModel<typeof users>;

declare module "h3" {
  interface H3EventContext {
    user?: DbUser;
  }
}

export async function getOrCreateUser(providerId: string): Promise<DbUser> {
  const db = useDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.providerId, providerId),
  });
  if (existing) return existing;

  const [created] = await db.insert(users).values({ providerId }).returning();
  return created;
}
