# Multi-User M1 — Authentication Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email-code sign-in with Supabase, a persisted encrypted session, authenticated navigation and an Account tab — while development builds without Supabase settings keep working exactly as today.

**Architecture:** A small `mobile/src/auth/` module (config resolution → encrypted storage → Supabase client → `AuthProvider` context). The root layout becomes a Stack whose routes are guarded with `Stack.Protected` by auth status; today's tabs move into an `(tabs)` group with a fourth Account tab. No backend or database changes.

**Tech Stack:** Expo SDK 57, expo-router 57 (`Stack.Protected`), `@supabase/supabase-js` v2, `expo-secure-store`, `@react-native-async-storage/async-storage`, `aes-js`, `expo-crypto`, `react-native-url-polyfill`; Jest + `@testing-library/react-native` + `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` (§6 M1, §2 research, §7 owner setup)

## Global Constraints

- App copy is English; native iOS look per `DESIGN.md` (system font, `type.*`, `colors.*`, `PillButton`, Large Title per screen, no shadows).
- App env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never a secret/service-role key in `mobile/`.
- Sign-in = 6-digit email code: `signInWithOtp({ email })` then `verifyOtp({ email, token, type: "email" })`. Resend allowed after 60 s.
- Client options: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`, storage = `LargeSecureStore`.
- Dev (`__DEV__`) + no settings → local mode, app as today. Release + no settings → blocking "Sign-in isn't configured" screen.
- Tabs: Home | Closet | Add | Account.
- Existing 163 app tests and the Python suite stay green; `npx tsc --noEmit` clean.

## Review Focus

1. Half-configured env (only URL, only key, malformed URL, or an `sb_secret_` key) → treated as **unconfigured** in every build, never silently local, never shipping a secret. (Task 1 tests.)
2. Corrupted or half-written stored session (Keychain key missing, ciphertext missing/garbled) → reads as "no session" and is cleared, app shows Sign In instead of crashing. (Task 2 tests.)
3. Sign-out while offline → user still ends up signed out on the device (local scope fallback). (Task 3 test.)
4. Pasted code with spaces/dashes ("123 456", "123-456") or an email with surrounding spaces/capitals → normalized, not rejected. (Task 4 tests.)
5. Switching accounts on one phone → no state from the previous user (last capture run) leaks to the next. (Task 5 test: `LastRunProvider` keyed by user.)

---

### Task 1: Dependencies and auth config

**Files:**
- Modify: `mobile/package.json`, `mobile/package-lock.json` (also syncs the lockfile, which is currently out of sync on `main` so `npm ci` fails)
- Create: `mobile/src/auth/config.ts`, `mobile/.env.example`
- Test: `mobile/__tests__/auth/config.test.ts`

**Interfaces:**
- Produces: `type AuthConfig = { mode: "supabase"; url: string; publishableKey: string } | { mode: "local" } | { mode: "unconfigured"; reason: string }`; `resolveAuthConfig(input: { url?: string; publishableKey?: string; isDev: boolean }): AuthConfig`; `authConfig: AuthConfig` (from `process.env.EXPO_PUBLIC_*` and `__DEV__`).

- [ ] Install: `npx expo install @supabase/supabase-js expo-secure-store @react-native-async-storage/async-storage expo-crypto react-native-url-polyfill` and `npm i aes-js` + `npm i -D @types/aes-js`; add `"expo-secure-store"` to `app.json` plugins.
- [ ] Write failing tests: both set (trimmed) → `supabase`; both empty + dev → `local`; both empty + release → `unconfigured`; only one set (dev and release) → `unconfigured`; URL not `http(s)://` → `unconfigured`; key starting `sb_secret_` → `unconfigured` with reason mentioning secret.
- [ ] Run `npx jest __tests__/auth/config.test.ts` → FAIL (module missing).
- [ ] Implement `resolveAuthConfig` / `authConfig`.
- [ ] Run → PASS. Write `mobile/.env.example` (both vars blank, comments: publishable key only; for the local CLI stack use `http://<your-mac-LAN-IP>:54321`).
- [ ] Commit `feat(app): auth config and Supabase dependencies`.

### Task 2: Encrypted session storage

**Files:**
- Create: `mobile/src/auth/largeSecureStore.ts`
- Test: `mobile/__tests__/auth/largeSecureStore.test.ts`

**Interfaces:**
- Produces: `class LargeSecureStore { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }`.

- [ ] Write failing tests (in-memory mocks for `expo-secure-store`, AsyncStorage's official jest mock, `expo-crypto.getRandomBytes` returning deterministic bytes): round-trip returns the value; AsyncStorage never contains the plaintext; `removeItem` clears both stores; missing SecureStore key → `null` and AsyncStorage entry removed; garbled ciphertext → `null`, both cleared; overwrite uses a fresh key.
- [ ] Run → FAIL.
- [ ] Implement per Supabase's Expo tutorial: per write a fresh 32-byte key from `getRandomBytes`, AES-256-CTR (`aes-js`, `new Counter(1)`), hex ciphertext in AsyncStorage under `key`, hex AES key in SecureStore under `key` with `keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Decrypt failure / non-hex → clear and return `null`.
- [ ] Run → PASS. Commit `feat(app): encrypted session storage`.

### Task 3: Supabase client and AuthProvider

**Files:**
- Create: `mobile/src/auth/supabase.ts`, `mobile/src/auth/messages.ts`, `mobile/src/auth/AuthProvider.tsx`
- Test: `mobile/__tests__/auth/messages.test.ts`, `mobile/__tests__/auth/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `AuthConfig`, `authConfig`, `LargeSecureStore`.
- Produces:
  - `createSupabase(config: { url: string; publishableKey: string }): SupabaseClient`; `watchAppState(client: SupabaseClient): () => void` (AppState active → `startAutoRefresh`, else `stopAutoRefresh`).
  - `normalizeEmail(s: string): string` (trim + lowercase); `isValidEmail(s: string): boolean`; `normalizeCode(s: string): string` (digits only); `authErrorMessage(error: unknown): string`.
  - `type AuthStatus = "loading" | "signedOut" | "signedIn" | "local" | "unconfigured"`; `useAuth(): { status: AuthStatus; email: string | null; userId: string | null; sendCode(email: string): Promise<void>; verifyCode(email: string, code: string): Promise<void>; signOut(): Promise<void> }`; `AuthProvider({ children, config?, client? })` where `client?: Pick<SupabaseClient, "auth">` for tests (default: `createSupabase(config)` when `config.mode === "supabase"`). Also export `AuthContext` for router tests.
- Messages (exact copy): rate limit (status 429 or code `over_email_send_rate_limit`) → "Too many codes requested. Wait a minute and try again."; code `otp_expired` → "That code is wrong or has expired. Check the email or send a new code."; network (`AuthRetryableFetchError`, status 0, `TypeError`) → "Can't reach the sign-in service. Check your connection and try again."; anything else → "Something went wrong. Try again."

- [ ] Write failing tests: messages mapping and normalizers; provider with `local` config → status `local`, no client calls; `unconfigured` → `unconfigured`; `supabase` with fake client: no session → `signedOut`; existing session → `signedIn` with email/userId; `sendCode(" A@B.com ")` calls `signInWithOtp({ email: "a@b.com" })`; `sendCode` error → rejects with mapped message; `verifyCode` success → `signedIn` (via `onAuthStateChange` callback); `signOut` → `signedOut`; `signOut` returning error → calls `signOut({ scope: "local" })` and still `signedOut`; unmount unsubscribes.
- [ ] Run → FAIL.
- [ ] Implement (`import "react-native-url-polyfill/auto"` in `supabase.ts`). Provider registers `watchAppState` only for a real client.
- [ ] Run → PASS. Commit `feat(app): Supabase auth provider`.

### Task 4: Sign In and Not Configured screens

**Files:**
- Create: `mobile/app/sign-in.tsx`, `mobile/src/components/NotConfigured.tsx`
- Test: `mobile/__tests__/SignInScreen.test.tsx`, `mobile/__tests__/NotConfigured.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `normalizeEmail`, `isValidEmail`, `normalizeCode`.
- Produces: default export `SignInScreen`; `NotConfigured({ reason }: { reason: string })`.
- Copy: email step — title "Sign in", body "Enter your email and we'll send you a 6-digit code.", input label "Email", button "Send code". Code step — title "Check your email", body "Enter the 6-digit code we sent to {email}.", input label "6-digit code" (`keyboardType="number-pad"`, `textContentType="oneTimeCode"`, `autoComplete="one-time-code"`), button "Sign in", "Resend code in {n}s" → "Resend code" after 60 s, "Use a different email". NotConfigured — title "Sign-in isn't configured", body "This build is missing its Supabase settings. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild.", plus `reason` in secondary text.

- [ ] Write failing tests (render with `AuthContext.Provider` and jest mocks): "Send code" disabled for invalid email, enabled for " Me@Example.com "; press → `sendCode` called with typed text, moves to code step showing normalized email; error from `sendCode` shown and stays on email step; code "123 456" typed → "Sign in" enabled and `verifyCode(email, "123456")`; verify error shown, input kept; resend disabled with countdown, enabled after advancing fake timers 60 s, calls `sendCode` again and restarts countdown; "Use a different email" returns to email step; buttons disabled while a request is in flight. NotConfigured renders title and reason.
- [ ] Run → FAIL.
- [ ] Implement with `SafeAreaView`, `type`/`colors`, `PillButton`, error box styled like `app/add.tsx`; `TextInput` styled as `card` field, 44pt min height.
- [ ] Run → PASS. Commit `feat(app): email code sign-in screen`.

### Task 5: Authenticated navigation and Account tab

**Files:**
- Move: `mobile/app/{index,closet,add}.tsx` → `mobile/app/(tabs)/{index,closet,add}.tsx` (fix relative imports `../src` → `../../src`)
- Create: `mobile/app/(tabs)/_layout.tsx` (today's `Tabs` config + Account), `mobile/app/(tabs)/account.tsx`, `mobile/src/RootNavigator.tsx`
- Modify: `mobile/app/_layout.tsx`, `mobile/src/components/Icon.tsx` (add `account: { sf: "person.crop.circle", ion: "person-circle-outline" }`), test imports in `mobile/__tests__/*.test.tsx` that import `../app/index|closet|add`
- Test: `mobile/__tests__/RootNavigator.test.tsx`, `mobile/__tests__/AccountScreen.test.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth`, `AuthContext`, `NotConfigured`, `SignInScreen`.
- Produces: `RootNavigator()` — `loading` → `null`; `unconfigured` → `<NotConfigured reason>`; else `Stack` (`headerShown: false`) with `Stack.Protected guard={signedIn || local}` → `(tabs)` and `Stack.Protected guard={signedOut}` → `sign-in`. Root layout: `AuthProvider` → `StatusBar` → `LastRunProvider key={userId ?? "local"}` → `RootNavigator`. Account copy: title "Account"; signed in — row "Email" + value, button "Sign out" → `Alert.alert("Sign out?", "You'll need a new email code to sign back in.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: signOut }])`; local — row "Local mode", text "Not signed in. Your items live on your computer's wardrobe server.", no Sign out.

- [ ] Write failing tests: `RootNavigator` via `renderRouter` with stub routes and a provided `AuthContext` value: `signedOut` → sign-in stub visible, tabs stub not; `signedIn` → tabs stub; `local` → tabs stub; `unconfigured` → "Sign-in isn't configured". Account: signed-in shows email, Sign out opens the Alert and its destructive action calls `signOut`; local shows "Local mode" and no Sign out. Root layout: switching `userId` remounts `LastRunProvider` (a run stored for user A is gone for user B).
- [ ] Run → FAIL.
- [ ] Move screens (`git mv`), update imports, implement layouts/screens.
- [ ] Run full `npx jest` and `npx tsc --noEmit` → all green (existing suites updated only in import paths).
- [ ] Commit `feat(app): authenticated navigation and Account tab`.

### Task 6: Local Supabase stack and docs

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`, then edit), `supabase/templates/magic_link.html`
- Modify: `README.md` (status + "Accounts (in progress)" setup section), `docs/ARCHITECTURE.md` (pointer at top to the 2026-10-18 design as the current multi-user plan), `docs/ROADMAP.md` (Multi-user M1–M5 checklist, M1 ticked), `.gitignore` if `supabase/.temp`/`.branches` need ignoring.

- [ ] `npx supabase init` (no VS Code settings); in `config.toml` set `[auth] site_url` unchanged, `[auth.email] enable_signup = true`, `otp_length = 6`, `otp_expiry = 3600`, `[auth.email.template.magic_link] subject = "Your Digital Wardrobe sign-in code"`, `content_path = "./supabase/templates/magic_link.html"`.
- [ ] Template: plain English email showing `{{ .Token }}` prominently; no link.
- [ ] If Docker is running: `npx supabase start`, set `mobile/.env` locally (not committed), and verify a code sign-in end-to-end via Mailpit (`http://127.0.0.1:54324`); otherwise record as not run.
- [ ] Verify: `cd mobile && npx jest && npx tsc --noEmit`; `PYTHONPATH=$PWD /Users/roisafran/Desktop/my_wardrobe/.venv/bin/pytest -q`; `git check-ignore mobile/.env` prints the path.
- [ ] Commit `docs: multi-user M1 setup and roadmap`.
