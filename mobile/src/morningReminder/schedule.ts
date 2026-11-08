// One-time morning outfit reminder (docs/features/morning-onboarding-reminder/): the pure parts — the
// app flag, when the reminder fires, the per-account record kept on this device and who may be offered it.
// No photos, ids, emails or tokens ever go into the notification itself: only the fixed `kind` below.
import { FIRST_GOAL } from "../firstPieces/round";

export const REMINDER_KIND = "onboarding_morning_outfit_v1";
export const REMINDER_TITLE = "Your outfit can start your closet 👕";
export const REMINDER_BODY = "Heading to work or class? Snap a mirror photo, then pick the pieces to add to KIPS 📸";
export const REMINDER_HOUR = 8;
export const REMINDER_MINUTE = 45;
export const MIN_GAP_MS = 12 * 60 * 60 * 1000;

// Off unless the build sets EXPO_PUBLIC_MORNING_REMINDER=on (mobile/.env). Turning it on for a beta build
// is the owner's decision. Read statically so Expo inlines it into the bundle.
export const reminderFlag = (raw: string | undefined) => (raw ?? "").trim().toLowerCase() === "on";
export const REMINDER_ENABLED = reminderFlag(process.env.EXPO_PUBLIC_MORNING_REMINDER);

// The next calendar morning at 08:45 phone time that is at least 12 hours away: Monday 17:00 → Tuesday
// 08:45; Monday 23:30 → Wednesday 08:45 (Tuesday would be under 12 hours). Built from local calendar
// fields, so a daylight-saving change in between still lands on 08:45 wall time. Always in the future.
export function nextReminderDate(now: Date): Date {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  while (at.getTime() - now.getTime() < MIN_GAP_MS) at.setDate(at.getDate() + 1);
  return at;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "tomorrow at 8:45 AM" / "Wednesday at 8:45 AM", built by hand so it never depends on the ICU build.
export function whenLabel(fireAt: number, now: Date): string {
  const d = new Date(fireAt);
  const h = d.getHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const sameDay = d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
  return `${sameDay ? "tomorrow" : WEEKDAYS[d.getDay()]} at ${time}`;
}

// unseen     never answered (the Home card may offer it)
// declined   "Not now": never offered again by itself
// denied     said yes but iOS notifications are off: nothing scheduled
// scheduling about to ask iOS to schedule (written first, so a crash in between can be reconciled)
// scheduled  one pending local notification, its id kept here
// opened     the reminder was tapped: done
// cancelled  turned off, signed out, notifications revoked, outfit photos off, or the third piece was saved
// expired    its time passed (or iOS no longer has it): never re-armed by itself, never counted as seen
export type ReminderStatus = "unseen" | "declined" | "denied" | "scheduling" | "scheduled" | "opened" | "cancelled" | "expired";
export type CancelReason = "three_saved" | "opt_out" | "sign_out" | "permission_off" | "outfit_off";
export type ReminderRecord = {
  status: ReminderStatus;
  id?: string;            // the local notification's identifier (kept after it fires, to recognise its tap)
  fireAt?: number;        // when it was set for (ms)
  reason?: CancelReason;
  introSeen?: boolean;    // the person has seen First 3 Pieces' start screen
  at: number;             // last change (ms)
};

export const recordKey = (userId: string) => `morningReminder.v1.${userId}`;
const STATUSES: ReminderStatus[] = ["unseen", "declined", "denied", "scheduling", "scheduled", "opened", "cancelled", "expired"];
const REASONS: CancelReason[] = ["three_saved", "opt_out", "sign_out", "permission_off", "outfit_off"];

export const UNSEEN: ReminderRecord = { status: "unseen", at: 0 };

// Anything unreadable counts as never answered.
export function parseRecord(raw: string | null | undefined): ReminderRecord {
  if (!raw) return UNSEEN;
  try {
    const r = JSON.parse(raw) as Partial<ReminderRecord>;
    if (!r || typeof r !== "object" || !STATUSES.includes(r.status as ReminderStatus)) return UNSEEN;
    return {
      status: r.status as ReminderStatus,
      at: typeof r.at === "number" ? r.at : 0,
      ...(typeof r.id === "string" && r.id ? { id: r.id } : {}),
      ...(typeof r.fireAt === "number" ? { fireAt: r.fireAt } : {}),
      ...(REASONS.includes(r.reason as CancelReason) ? { reason: r.reason } : {}),
      ...(r.introSeen ? { introSeen: true } : {}),
    };
  } catch {
    return UNSEEN;
  }
}

// A deliberate "Remind me" is possible from these states (Home's card for unseen; Account for the rest).
// Used, expired and completed reminders stay one-time.
export function canArm(r: ReminderRecord): boolean {
  if (r.status === "unseen" || r.status === "declined" || r.status === "denied") return true;
  return r.status === "cancelled" && r.reason !== "three_saved";
}

export type OfferInput = {
  enabled: boolean;          // the app flag
  signedIn: boolean;
  outfit: boolean;           // the server offers worn (outfit) photos
  savedCount: number | null; // saved closet pieces from the server; null = not known yet
  introSeen: boolean;        // First 3 Pieces was shown to this account
  record: ReminderRecord;
};

// Home's one-time card: an account with 0–2 saved pieces that has seen First 3 Pieces and never answered.
export function shouldOffer(i: OfferInput): boolean {
  return i.enabled && i.signedIn && i.outfit && i.introSeen && i.record.status === "unseen"
    && i.savedCount !== null && i.savedCount < FIRST_GOAL;
}

// Only this feature's own notifications (job-result pushes carry job_id/kind with a job kind).
export function isReminderData(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { kind?: unknown }).kind === REMINDER_KIND;
}
