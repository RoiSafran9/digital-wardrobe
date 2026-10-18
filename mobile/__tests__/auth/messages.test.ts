import { authErrorMessage, isValidEmail, normalizeCode, normalizeEmail } from "../../src/auth/messages";

const apiError = (status: number, code?: string) => Object.assign(new Error("x"), { name: "AuthApiError", status, code });

test("rate limits get a wait-a-minute message", () => {
  expect(authErrorMessage(apiError(429))).toBe("Too many codes requested. Wait a minute and try again.");
  expect(authErrorMessage(apiError(400, "over_email_send_rate_limit"))).toBe("Too many codes requested. Wait a minute and try again.");
});

test("a wrong or expired code says so", () => {
  expect(authErrorMessage(apiError(403, "otp_expired"))).toBe("That code is wrong or has expired. Check the email or send a new code.");
});

test("network failures point at the connection", () => {
  const msg = "Can't reach the sign-in service. Check your connection and try again.";
  expect(authErrorMessage(Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError", status: 0 }))).toBe(msg);
  expect(authErrorMessage(new TypeError("Network request failed"))).toBe(msg);
});

test("anything else is a generic retry", () => {
  expect(authErrorMessage(apiError(500, "unexpected_failure"))).toBe("Something went wrong. Try again.");
  expect(authErrorMessage("weird")).toBe("Something went wrong. Try again.");
});

test("emails are trimmed and lowercased; validation is forgiving but needs user@domain.tld", () => {
  expect(normalizeEmail("  Me@Example.COM \n")).toBe("me@example.com");
  expect(isValidEmail(" Me@Example.com ")).toBe(true);
  expect(isValidEmail("me@example")).toBe(false);
  expect(isValidEmail("me example.com")).toBe(false);
  expect(isValidEmail("")).toBe(false);
});

test("pasted codes keep only their digits", () => {
  expect(normalizeCode("123 456")).toBe("123456");
  expect(normalizeCode("123-456")).toBe("123456");
  expect(normalizeCode(" 12a34 ")).toBe("1234");
});
