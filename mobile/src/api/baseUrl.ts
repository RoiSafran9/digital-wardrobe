// The API runs on the same computer that serves the app through Expo, on port 8000.
// Deriving it from Expo's host means a new Wi-Fi (new LAN IP) needs no config change.
export const API_PORT = 8000;

export function resolveApiBaseUrl({ envUrl, hostUri }: { envUrl?: string; hostUri?: string | null }): string {
  if (envUrl) return envUrl;
  const host = hostUri?.split(":")[0];
  return `http://${host || "localhost"}:${API_PORT}`;
}
