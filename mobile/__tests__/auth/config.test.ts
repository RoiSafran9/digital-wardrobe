import { resolveAuthConfig } from "../../src/auth/config";

const URL = "https://abc.supabase.co";
const KEY = "sb_publishable_abc123";

test("both settings present (trimmed) → supabase mode", () => {
  expect(resolveAuthConfig({ url: ` ${URL} `, publishableKey: ` ${KEY}\n`, isDev: false })).toEqual({
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
