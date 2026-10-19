import { resolveAuthConfig } from "../../src/auth/config";

const URL = "https://abc.supabase.co";
const KEY = "sb_publishable_abc123";

const API = "https://api.example.com";

test("both settings present (trimmed) → supabase mode", () => {
  expect(resolveAuthConfig({ url: ` ${URL} `, publishableKey: ` ${KEY}\n`, isDev: false, apiUrl: API })).toEqual({
    mode: "supabase", url: URL, publishableKey: KEY,
  });
});

test("no settings in development → local mode, the app works as today", () => {
  expect(resolveAuthConfig({ url: undefined, publishableKey: "", isDev: true })).toEqual({ mode: "local" });
});

test("no settings in a release build → unconfigured", () => {
  expect(resolveAuthConfig({ isDev: false }).mode).toBe("unconfigured");
});

test.each([true, false])("only one setting is a mistake, never local (dev=%s)", (isDev) => {
  expect(resolveAuthConfig({ url: URL, isDev }).mode).toBe("unconfigured");
  expect(resolveAuthConfig({ publishableKey: KEY, isDev }).mode).toBe("unconfigured");
});

test("a URL that isn't http(s) → unconfigured", () => {
  expect(resolveAuthConfig({ url: "abc.supabase.co", publishableKey: KEY, isDev: true }).mode).toBe("unconfigured");
});

test("a secret key is refused so it can never ship in the app", () => {
  const config = resolveAuthConfig({ url: URL, publishableKey: "sb_secret_xyz", isDev: true });
  expect(config.mode).toBe("unconfigured");
  expect(config.mode === "unconfigured" && config.reason).toMatch(/secret/i);
});

test("a release build needs the hosted server over https, never the home network", () => {
  const release = (apiUrl?: string) => resolveAuthConfig({ url: URL, publishableKey: KEY, isDev: false, apiUrl });
  expect(release(undefined).mode).toBe("unconfigured");
  expect(release("http://api.example.com").mode).toBe("unconfigured");
  expect(release("https://192.168.1.238:8000").mode).toBe("unconfigured");
  expect(release("https://localhost").mode).toBe("unconfigured");
  expect(release(API).mode).toBe("supabase");
  // Development keeps finding the Mac on the Wi-Fi.
  expect(resolveAuthConfig({ url: URL, publishableKey: KEY, isDev: true }).mode).toBe("supabase");
});
