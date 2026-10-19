// Normalizing what people type or paste, and turning Supabase Auth errors into sentences.
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(s));
}

export function normalizeCode(s: string): string {
  return s.replace(/\D/g, "");
}

export function authErrorMessage(error: unknown): string {
  const { name, status, code } = (error ?? {}) as { name?: string; status?: number; code?: string };
  if (status === 429 || code === "over_email_send_rate_limit") return "Too many codes requested. Wait a minute and try again.";
  if (code === "invalid_credentials") return "That email and password don't match.";
  if (code === "otp_expired") return "That code is wrong or has expired. Check the email or send a new code.";
  if (name === "AuthRetryableFetchError" || status === 0 || error instanceof TypeError) {
    return "Can't reach the sign-in service. Check your connection and try again.";
  }
  return "Something went wrong. Try again.";
}
