import { getAccountPlan } from "../../utils/subscriptions";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  return getAccountPlan(user.id);
});
