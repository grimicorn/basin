## Auth

### The first-login upsert

On the first authenticated request, look up provider_id — create the user if they don't exist yet:

```ts
// server/utils/auth.ts
export async function getOrCreateUser(providerId: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.providerId, providerId),
  });
  if (existing) return existing;

  const [created] = await db.insert(users).values({ providerId }).returning();
  return created;
}
```

Call this in a Nuxt server middleware so userId is available on every authenticated route:

```ts
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  const token = getHeader(event, "authorization");
  if (!token) return;

  const payload = verifyToken(token); // Clerk/Auth0 JWT verification
  event.context.user = await getOrCreateUser(payload.sub);
});
```

### Clerk vs Auth0 for this pattern

Clerk is the better fit here — it's designed around the "bring your own database" model. It fires webhooks on user.created and user.deleted so you can keep your table in sync automatically rather than relying solely on the first-login upsert. It also has a @clerk/nuxt module that handles the JWT verification boilerplate.
