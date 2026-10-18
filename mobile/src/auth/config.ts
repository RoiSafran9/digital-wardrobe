// Which sign-in setup this build runs with. Development builds without Supabase settings keep
// working as the single-owner local app; release builds and half-filled settings are refused.
export type AuthConfig =
  | { mode: "supabase"; url: string; publishableKey: string }
  | { mode: "local" }
  | { mode: "unconfigured"; reason: string };

export function resolveAuthConfig({ url, publishableKey, isDev }: { url?: string; publishableKey?: string; isDev: boolean }): AuthConfig {
  const u = url?.trim() ?? "";
  const key = publishableKey?.trim() ?? "";
  if (!u && !key) {
    return isDev ? { mode: "local" } : { mode: "unconfigured", reason: "Supabase URL and publishable key are missing." };
  }
  if (!u || !key) {
    return { mode: "unconfigured", reason: `Supabase ${u ? "publishable key" : "URL"} is missing.` };
  }
  if (!/^https?:\/\/\S+$/.test(u)) {
    return { mode: "unconfigured", reason: "Supabase URL must start with http:// or https://." };
  }
  if (key.startsWith("sb_secret_")) {
    return { mode: "unconfigured", reason: "That is a secret key. The app needs the publishable key; secret keys must never ship in the app." };
  }
  return { mode: "supabase", url: u, publishableKey: key };
}

export const authConfig: AuthConfig = resolveAuthConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  isDev: __DEV__,
});
