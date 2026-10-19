// Which sign-in setup this build runs with. Development builds without Supabase settings keep
// working as the single-owner local app; release builds and half-filled settings are refused.
export type AuthConfig =
  | { mode: "supabase"; url: string; publishableKey: string }
  | { mode: "local" }
  | { mode: "unconfigured"; reason: string };

// A release build must talk to a hosted server over HTTPS, never to a computer on the home network.
export function releaseApiProblem(apiUrl: string | undefined): string | null {
  const u = (apiUrl ?? "").trim();
  if (!u) return "The server address (EXPO_PUBLIC_API_URL) is missing.";
  let host: string;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return "The server address must use https://.";
    host = parsed.hostname.toLowerCase();
  } catch {
    return "The server address isn't a valid URL.";
  }
  const lan = host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  return lan ? "The server address points at a local network; release builds need the hosted server." : null;
}

export function resolveAuthConfig({ url, publishableKey, isDev, apiUrl }: { url?: string; publishableKey?: string; isDev: boolean; apiUrl?: string }): AuthConfig {
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
  if (!isDev) {
    const problem = releaseApiProblem(apiUrl);
    if (problem) return { mode: "unconfigured", reason: problem };
  }
  return { mode: "supabase", url: u, publishableKey: key };
}

export const authConfig: AuthConfig = resolveAuthConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  isDev: __DEV__,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
});
