import { resolveApiBaseUrl } from "../src/api/baseUrl";

test("follows the computer Expo is served from, so a new Wi-Fi needs no config", () => {
  expect(resolveApiBaseUrl({ hostUri: "10.0.0.29:8081" })).toBe("http://10.0.0.29:8000");
});

test("an explicit EXPO_PUBLIC_API_URL still wins", () => {
  expect(resolveApiBaseUrl({ envUrl: "http://192.168.1.5:9000", hostUri: "10.0.0.29:8081" })).toBe("http://192.168.1.5:9000");
});

test("falls back to localhost when there is no dev host (e.g. tests)", () => {
  expect(resolveApiBaseUrl({})).toBe("http://localhost:8000");
});
