// Where people can write for help. Set EXPO_PUBLIC_SUPPORT_EMAIL in mobile/.env; nothing is committed,
// and without it the app shows no contact row.
export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "").trim();
