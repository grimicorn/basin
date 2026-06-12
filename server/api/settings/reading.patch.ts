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
const VALID_RADII = new Set(["sharp", "default", "round"]);
const VALID_LAYOUTS = new Set(["timeline", "grid", "columns"]);

const BOOLEAN_FIELDS = [
  "showUnreadOnly",
  "autoplayMediaPreviews",
  "compactNotifications",
] as const;

const STRING_FIELDS = [
  "theme",
  "accentColor",
  "readingFont",
  "spacing",
  "radius",
  "layout",
] as const;

type BooleanField = (typeof BOOLEAN_FIELDS)[number];

type ReadingSettingsPatch = {
  theme?: string;
  accentColor?: string;
  readingFont?: string;
  spacing?: string;
  radius?: string;
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

function invalidBooleanField(
  body: ReadingSettingsPatch,
  fieldName: BooleanField,
): string | null {
  const value = body[fieldName];
  if (value !== undefined && typeof value !== "boolean")
    return `Invalid ${fieldName}: must be a boolean`;
  return null;
}

function validatePatch(body: ReadingSettingsPatch): string | null {
  return (
    invalidField(body.theme, VALID_THEMES, "theme") ??
    invalidField(body.accentColor, VALID_ACCENT_COLORS, "accentColor") ??
    invalidField(body.readingFont, VALID_READING_FONTS, "readingFont") ??
    invalidField(body.spacing, VALID_SPACINGS, "spacing") ??
    invalidField(body.radius, VALID_RADII, "radius") ??
    invalidField(body.layout, VALID_LAYOUTS, "layout") ??
    invalidBooleanField(body, "showUnreadOnly") ??
    invalidBooleanField(body, "autoplayMediaPreviews") ??
    invalidBooleanField(body, "compactNotifications")
  );
}

function pickDefinedFields(
  body: ReadingSettingsPatch,
  fields: ReadonlyArray<keyof ReadingSettingsPatch>,
): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
}

function buildUpdateValues(body: ReadingSettingsPatch) {
  return {
    updatedAt: new Date(),
    ...pickDefinedFields(body, STRING_FIELDS),
    ...pickDefinedFields(body, BOOLEAN_FIELDS),
  };
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
    radius: updated.radius,
    layout: updated.layout,
    showUnreadOnly: updated.showUnreadOnly,
    autoplayMediaPreviews: updated.autoplayMediaPreviews,
    compactNotifications: updated.compactNotifications,
  };
});
