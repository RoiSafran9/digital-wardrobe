// The morning reminder's pure rules (src/morningReminder/schedule.ts), in the machine's own time zone.

import {
  canArm, isReminderData, MIN_GAP_MS, nextReminderDate, parseRecord, REMINDER_KIND, reminderFlag, shouldOffer,
  UNSEEN, whenLabel, type OfferInput,
} from "../src/morningReminder/schedule";

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const parts = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];

describe("nextReminderDate", () => {
  test("N05: Monday 17:00 → Tuesday 08:45", () => {
    expect(parts(nextReminderDate(at(2026, 11, 9, 17)))).toEqual([2026, 11, 10, 8, 45]);
  });

  test("N06: Monday 23:30 → Wednesday 08:45 (Tuesday is under 12 hours away)", () => {
    expect(parts(nextReminderDate(at(2026, 11, 9, 23, 30)))).toEqual([2026, 11, 11, 8, 45]);
  });

  test("early morning: never later the same day, the next calendar morning", () => {
    expect(parts(nextReminderDate(at(2026, 11, 9, 6)))).toEqual([2026, 11, 10, 8, 45]);
  });

  test("exactly 12 hours before is enough; one minute less is not", () => {
    expect(parts(nextReminderDate(at(2026, 11, 9, 20, 45)))).toEqual([2026, 11, 10, 8, 45]);
    expect(parts(nextReminderDate(at(2026, 11, 9, 20, 46)))).toEqual([2026, 11, 11, 8, 45]);
  });

  test("month and year ends roll over", () => {
    expect(parts(nextReminderDate(at(2026, 12, 31, 12)))).toEqual([2027, 1, 1, 8, 45]);
    expect(parts(nextReminderDate(at(2027, 2, 28, 22)))).toEqual([2027, 3, 2, 8, 45]);
  });

  // The days whose UTC offset differs from the day before (daylight saving changes), for this machine's zone
  // and for a fixed US/EU-like set of dates; a zone without daylight saving still checks those nights.
  const offsetChanges = (year: number) => {
    const days: Date[] = [];
    for (let d = new Date(year, 0, 2); d.getFullYear() === year; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const before = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12);
      if (new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTimezoneOffset() !== before.getTimezoneOffset()) days.push(d);
    }
    return days;
  };

  test("N24: across daylight saving changes it stays 08:45 wall time, in the future, ≥12h away", () => {
    const nights = [...offsetChanges(2026), at(2026, 3, 8, 12), at(2026, 3, 27, 12), at(2026, 3, 29, 12), at(2026, 10, 25, 12), at(2026, 11, 1, 12)];
    for (const change of nights) {
      for (const hour of [18, 21, 23]) {
        const now = new Date(change.getFullYear(), change.getMonth(), change.getDate() - 1, hour, 30);
        const next = nextReminderDate(now);
        expect([next.getHours(), next.getMinutes()]).toEqual([8, 45]);
        expect(next.getTime() - now.getTime()).toBeGreaterThanOrEqual(MIN_GAP_MS);
        expect(next.getTime() - now.getTime()).toBeLessThan(MIN_GAP_MS + 2 * 24 * 3600_000);
      }
    }
  });

  test("a clock set far back or forward still gives one future time", () => {
    for (const now of [new Date(2001, 0, 1, 3), new Date(2040, 5, 15, 23, 59)]) {
      expect(nextReminderDate(now).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

test("whenLabel says tomorrow or the weekday, with a plain 12-hour time", () => {
  const now = at(2026, 11, 9, 17);  // a Monday
  expect(whenLabel(at(2026, 11, 10, 8, 45).getTime(), now)).toBe("tomorrow at 8:45 AM");
  expect(whenLabel(at(2026, 11, 11, 8, 45).getTime(), now)).toBe("Wednesday at 8:45 AM");
});

test("the app flag is off unless set to on", () => {
  expect(reminderFlag(undefined)).toBe(false);
  expect(reminderFlag("")).toBe(false);
  expect(reminderFlag("off")).toBe(false);
  expect(reminderFlag("true")).toBe(false);
  expect(reminderFlag(" ON ")).toBe(true);
});

test("records: anything unreadable is unanswered; unknown fields are dropped", () => {
  expect(parseRecord(null)).toEqual(UNSEEN);
  expect(parseRecord("{not json")).toEqual(UNSEEN);
  expect(parseRecord(JSON.stringify({ status: "hacked" }))).toEqual(UNSEEN);
  expect(parseRecord(JSON.stringify({ status: "scheduled", id: "n1", fireAt: 5, at: 1, email: "a@b.c" })))
    .toEqual({ status: "scheduled", id: "n1", fireAt: 5, at: 1 });
  expect(parseRecord(JSON.stringify({ status: "cancelled", reason: "nope", at: 2 }))).toEqual({ status: "cancelled", at: 2 });
});

test("one-time: used, expired and completed reminders can't be armed again", () => {
  expect(canArm(UNSEEN)).toBe(true);
  expect(canArm({ status: "declined", at: 1 })).toBe(true);
  expect(canArm({ status: "denied", at: 1 })).toBe(true);
  expect(canArm({ status: "cancelled", reason: "opt_out", at: 1 })).toBe(true);
  for (const r of [{ status: "scheduled" }, { status: "scheduling" }, { status: "opened" }, { status: "expired" },
                   { status: "cancelled", reason: "three_saved" }] as const) {
    expect(canArm({ ...r, at: 1 })).toBe(false);
  }
});

describe("shouldOffer", () => {
  const base: OfferInput = { enabled: true, signedIn: true, outfit: true, savedCount: 0, introSeen: true, record: UNSEEN };
  test("N02: an account with 0, 1 or 2 saved pieces that has seen First 3 Pieces", () => {
    for (const savedCount of [0, 1, 2]) expect(shouldOffer({ ...base, savedCount })).toBe(true);
  });
  test("N03: three or more saved pieces, or a count not known yet", () => {
    for (const savedCount of [3, 4, 40, null]) expect(shouldOffer({ ...base, savedCount })).toBe(false);
  });
  test("N04: flag off, outfit photos off, signed out / local mode, or before First 3 Pieces", () => {
    expect(shouldOffer({ ...base, enabled: false })).toBe(false);
    expect(shouldOffer({ ...base, outfit: false })).toBe(false);
    expect(shouldOffer({ ...base, signedIn: false })).toBe(false);
    expect(shouldOffer({ ...base, introSeen: false })).toBe(false);
  });
  test("N07: never again once answered", () => {
    for (const status of ["declined", "denied", "scheduled", "opened", "cancelled", "expired"] as const) {
      expect(shouldOffer({ ...base, record: { status, at: 1 } })).toBe(false);
    }
  });
});

test("N21: only this feature's notifications are recognised; job pushes are not", () => {
  expect(isReminderData({ kind: REMINDER_KIND })).toBe(true);
  expect(isReminderData({ job_id: "j1", kind: "garment" })).toBe(false);
  expect(isReminderData({ job_id: "j1", kind: "outfit_generate" })).toBe(false);
  expect(isReminderData(null)).toBe(false);
  expect(isReminderData("onboarding_morning_outfit_v1")).toBe(false);
});
