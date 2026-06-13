const DEFAULTS = {
  theme: "system",
  accentColor: "violet",
  readingFont: "serif",
  spacing: "cozy",
  radius: "sharp",
  layout: "timeline",
  showUnreadOnly: false,
  autoplayMediaPreviews: false,
  compactNotifications: false,
};

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const settings = await useDb().query.userSettings.findFirst({
    where: { userId: user.id },
  });

  if (!settings) return DEFAULTS;

  return {
    theme: settings.theme,
    accentColor: settings.accentColor,
    readingFont: settings.readingFont,
    spacing: settings.spacing,
    radius: settings.radius,
    layout: settings.layout,
    showUnreadOnly: settings.showUnreadOnly,
    autoplayMediaPreviews: settings.autoplayMediaPreviews,
    compactNotifications: settings.compactNotifications,
  };
});
