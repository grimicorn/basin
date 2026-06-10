import { userSettings } from "../../db/schema";

const VALID_THEMES = new Set(["system", "light", "dark"]);
const VALID_ACCENT_COLORS = new Set([
  "violet",
  "blue",
  "teal",
  "amber",
  "rose",
]);
const VALID_READING_FONTS = new Set(["mono", "serif"]);
const VALID_SPACINGS = new Set(["compact", "cozy", "roomy"]);
const VALID_LAYOUTS = new Set(["timeline", "grid", "columns"]);

type ReadingSettingsPatch = {
  theme?: string;
  accentColor?: string;
  readingFont?: string;
  spacing?: string;
  layout?: string;
  showUnreadOnly?: boolean;
  autoplayMediaPreviews?: boolean;
  compactNotifications?: boolean;
};

function invalidField(
  value: string | undefined,
  validSet: Set<string>,
  fieldName: string,
): string | null {
  if (value !== undefined && !validSet.has(value))
    return `Invalid ${fieldName}: ${value}`;
  return null;
}

function validatePatch(body: ReadingSettingsPatch): string | null {
  return (
    invalidField(body.theme, VALID_THEMES, "theme") ??
    invalidField(body.accentColor, VALID_ACCENT_COLORS, "accentColor") ??
    invalidField(body.readingFont, VALID_READING_FONTS, "readingFont") ??
    invalidField(body.spacing, VALID_SPACINGS, "spacing") ??
    invalidField(body.layout, VALID_LAYOUTS, "layout")
  );
}

function buildUpdateValues(body: ReadingSettingsPatch) {
  const values: Record<string, unknown> = { updatedAt: new Date() };

  if (body.theme !== undefined) values.theme = body.theme;
  if (body.accentColor !== undefined) values.accentColor = body.accentColor;
  if (body.readingFont !== undefined) values.readingFont = body.readingFont;
  if (body.spacing !== undefined) values.spacing = body.spacing;
  if (body.layout !== undefined) values.layout = body.layout;
  if (body.showUnreadOnly !== undefined)
    values.showUnreadOnly = body.showUnreadOnly;
  if (body.autoplayMediaPreviews !== undefined)
    values.autoplayMediaPreviews = body.autoplayMediaPreviews;
  if (body.compactNotifications !== undefined)
    values.compactNotifications = body.compactNotifications;

  return values;
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const body = await readBody<ReadingSettingsPatch>(event);
  const validationError = validatePatch(body);
  if (validationError)
    throw createError({ statusCode: 400, statusMessage: validationError });

  const updateValues = buildUpdateValues(body);
  const db = useDb();

  const [updated] = await db
    .insert(userSettings)
    .values({ userId: user.id, ...updateValues })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: updateValues,
    })
    .returning();

  return {
    theme: updated.theme,
    accentColor: updated.accentColor,
    readingFont: updated.readingFont,
    spacing: updated.spacing,
    layout: updated.layout,
    showUnreadOnly: updated.showUnreadOnly,
    autoplayMediaPreviews: updated.autoplayMediaPreviews,
    compactNotifications: updated.compactNotifications,
  };
});
