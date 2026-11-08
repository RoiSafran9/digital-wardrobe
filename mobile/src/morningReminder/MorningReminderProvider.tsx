import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getItems } from "../api/client";
import { track, trackPermission } from "../activity/track";
import { useAuth } from "../auth/AuthProvider";
import { useCredits } from "../credits/CreditsProvider";
import { offeredKey } from "../firstPieces/offer";
import { FIRST_GOAL } from "../firstPieces/round";
import { subscribeCloset } from "./closetSignal";
import {
  canArm, isReminderData, nextReminderDate, parseRecord, recordKey, REMINDER_BODY, REMINDER_ENABLED, REMINDER_KIND,
  REMINDER_TITLE, shouldOffer, UNSEEN, type CancelReason, type ReminderRecord,
} from "./schedule";

// The one-time morning outfit reminder: a single local iOS notification at the next eligible 08:45, only
// after the person taps "Remind me" (a consent of its own — "Notify when ready" is not it, and no push
// token is involved). Kept per account on this device under morningReminder.v1.<userId>; every change goes
// through one queue so rapid taps, remounts and lifecycle checks never schedule twice. It is cancelled — by
// its own id only, never "cancel all" — when the third piece is saved, the person turns it off, signs out,
// switches account or deletes it, turns notifications off, or outfit photos go away. Known limit: while
// the app is closed nothing can re-check the server, so a third piece saved on another device can't stop it.

export const OUTFIT_OFF = "Outfit photos aren't available right now.";
export const CANT_CHECK = "Couldn't check your closet. Try again.";
export const SAVE_FAILED = "Couldn't set the reminder. Try again.";

export type TapClaim = "mine" | "used" | "other";
export type Notice = "set" | "denied" | null;

export type ReminderValue = {
  enabled: boolean;
  record: ReminderRecord | null;  // this account's record (null: not signed in or still loading)
  offerVisible: boolean;          // Home's one-time card
  armable: boolean;               // Account may offer a deliberate "Remind me"
  busy: boolean;
  error: string | null;
  notice: Notice;                 // right after answering: "set", or "denied" (iOS notifications are off)
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  turnOff: () => Promise<void>;
  dismissNotice: () => void;
  noteIntroSeen: () => void;
  forgetAccount: () => Promise<void>;  // Delete Account: cancel and forget this account's record
  claimTap: (identifier: string) => Promise<TapClaim>;
};

const noop = async () => {};
const ReminderContext = createContext<ReminderValue>({
  enabled: false, record: null, offerVisible: false, armable: false, busy: false, error: null, notice: null,
  accept: noop, decline: noop, turnOff: noop, dismissNotice: () => {}, noteIntroSeen: () => {}, forgetAccount: noop,
  claimTap: async () => "other",
});
export const useMorningReminder = () => useContext(ReminderContext);

// --- this device's notifications and storage -------------------------------------------------------------

async function read(userId: string): Promise<ReminderRecord> {
  return parseRecord(await AsyncStorage.getItem(recordKey(userId)).catch(() => null));
}

function put(userId: string, r: ReminderRecord): Promise<void> {
  return AsyncStorage.setItem(recordKey(userId), JSON.stringify(r));
}

// This feature's pending notifications only; null when iOS couldn't be asked.
async function pendingReminders(): Promise<string[] | null> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return (all ?? []).filter((r) => isReminderData(r?.content?.data)).map((r) => r.identifier);
  } catch {
    return null;
  }
}

async function cancelNative(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// An alert-capable yes (provisional, quiet delivery doesn't count).
export function permissionAllowed(p: Notifications.NotificationPermissionsStatus | null | undefined): boolean {
  return !!p?.granted && p.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function currentPermission(): Promise<Notifications.NotificationPermissionsStatus | null> {
  try { return await Notifications.getPermissionsAsync(); } catch { return null; }
}

// ---------------------------------------------------------------------------------------------------------

export function MorningReminderProvider({ children, enabled = REMINDER_ENABLED }: { children: React.ReactNode; enabled?: boolean }) {
  const { status, userId } = useAuth();
  const { credits, outfit } = useCredits();
  const uid = status === "signedIn" ? userId : null;
  const owner = useRef<string | null>(null);
  owner.current = uid;
  const flags = useRef({ loaded: false, outfit: false });
  flags.current = { loaded: !!credits, outfit: !!outfit };
  const count = useRef<number | null>(null);

  const [record, setRecord] = useState<ReminderRecord | null>(null);
  const [intro, setIntro] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const acting = useRef(false);

  // One operation at a time, in order.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const serial = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(fn, fn);
    chain.current = next.catch(() => {});
    return next;
  }, []);

  // React state only ever shows the signed-in account's own record.
  const show = useCallback((forUser: string, r: ReminderRecord | null) => {
    if (owner.current === forUser) setRecord(r);
  }, []);

  const cancelPending = useCallback(async (forUser: string, reason: CancelReason, r: ReminderRecord): Promise<ReminderRecord> => {
    if (r.status !== "scheduled" && r.status !== "scheduling") return r;
    if (r.id) await cancelNative(r.id);
    if (r.status === "scheduling") for (const id of (await pendingReminders()) ?? []) await cancelNative(id);
    const next: ReminderRecord = { ...r, status: "cancelled", reason, at: Date.now() };
    await put(forUser, next).catch(() => {});  // if this fails, the next check finds it gone from iOS: expired
    if (owner.current === forUser) track("onboarding_nudge_cancelled", { reason });
    return next;
  }, []);

  const cancelFor = useCallback((forUser: string, reason: CancelReason) => serial(async () => {
    const next = await cancelPending(forUser, reason, await read(forUser));
    show(forUser, next);
  }), [serial, cancelPending, show]);

  // Bring this account's record in line with iOS and the app's current knowledge.
  const reconcile = useCallback((forUser: string) => serial(async () => {
    let r = await read(forUser);
    let native = await pendingReminders();
    const now = Date.now();
    if (r.status === "scheduling" && native) {
      // Closed between asking iOS and writing the id down: adopt what iOS has, or go back to unanswered.
      const [keep, ...extra] = native;
      for (const id of extra) await cancelNative(id);
      native = keep ? [keep] : [];
      r = keep ? { ...r, status: "scheduled", id: keep, at: now } : { ...r, status: "unseen", at: now };
      await put(forUser, r).catch(() => {});
    }
    if (r.status === "scheduled") {
      const stillPending = native ? native.includes(r.id ?? "") : true;
      if (!stillPending || (r.fireAt ?? 0) <= now) {
        // Its time came (or iOS dropped it). Never re-armed, never counted as shown.
        r = { ...r, status: "expired", at: now };
        await put(forUser, r).catch(() => {});
      } else {
        const perm = await currentPermission();
        if (perm && !permissionAllowed(perm)) r = await cancelPending(forUser, "permission_off", r);
        else if (flags.current.loaded && !flags.current.outfit) r = await cancelPending(forUser, "outfit_off", r);
        else if (count.current !== null && count.current >= FIRST_GOAL) r = await cancelPending(forUser, "three_saved", r);
      }
    }
    // Anything of ours that isn't this account's one pending reminder (another account's, a duplicate).
    const keepId = r.status === "scheduled" ? r.id : undefined;
    for (const id of native ?? []) if (id !== keepId) await cancelNative(id);
    show(forUser, r);
  }), [serial, cancelPending, show]);

  // Signed out or local mode: no reminder of ours may stay pending on this phone.
  const sweep = useCallback(() => serial(async () => {
    for (const id of (await pendingReminders()) ?? []) await cancelNative(id);
  }), [serial]);

  // Account changes: cancel the previous account's reminder first, then load and check the new one.
  const prevUser = useRef<string | null>(null);
  useEffect(() => {
    if (status === "loading") return;
    if (!enabled) { void sweep(); return; }  // the flag was turned off in a later build: nothing stays pending
    const prev = prevUser.current;
    prevUser.current = uid;
    setRecord(null);
    setSavedCount(null);
    count.current = null;
    setIntro(false);
    setError(null);
    setNotice(null);
    if (prev && prev !== uid) void cancelFor(prev, "sign_out");
    if (!uid) { void sweep(); return; }
    void AsyncStorage.getItem(offeredKey(uid)).then((v) => { if (v === "1" && owner.current === uid) setIntro(true); }).catch(() => {});
    void reconcile(uid);
  }, [enabled, status, uid, cancelFor, sweep, reconcile]);

  // Back in the app: notifications may have been turned off in Settings, or the time may have passed.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && owner.current) void reconcile(owner.current);
    });
    return () => sub.remove();
  }, [enabled, reconcile]);

  // The server stopped offering outfit photos.
  const outfitOff = !!credits && !outfit;
  useEffect(() => {
    if (enabled && uid && outfitOff) void cancelFor(uid, "outfit_off");
  }, [enabled, uid, outfitOff, cancelFor]);

  // The saved closet's size from the server; the third saved piece ends the reminder.
  const scheduled = record?.status === "scheduled";
  const scheduledRef = useRef(false);
  scheduledRef.current = scheduled;
  useEffect(() => {
    if (!enabled) return;
    return subscribeCloset({
      count: (n) => {
        const forUser = owner.current;
        if (!forUser) return;
        count.current = n;
        setSavedCount(n);
        if (n >= FIRST_GOAL) void cancelFor(forUser, "three_saved");
        void AsyncStorage.getItem(offeredKey(forUser)).then((v) => { if (v === "1" && owner.current === forUser) setIntro(true); }).catch(() => {});
      },
      saved: () => {
        // A flow just saved pieces: only worth a look at the closet while a reminder is pending.
        if (owner.current && scheduledRef.current) void getItems().catch(() => {});
      },
    });
  }, [enabled, cancelFor]);

  const accept = useCallback(async () => {
    const forUser = owner.current;
    if (!enabled || !forUser || acting.current) return;
    acting.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    track("onboarding_nudge_choice", { choice: "accepted" });
    await serial(async () => {
      try {
        const r = await read(forUser);
        if (!canArm(r)) return show(forUser, r);  // already set, used or finished: never a second one
        if (!flags.current.outfit) throw new Error(OUTFIT_OFF);
        let saved: number;
        try { saved = (await getItems()).items.length; } catch { throw new Error(CANT_CHECK); }
        if (owner.current !== forUser) return;
        if (saved >= FIRST_GOAL) {
          const done: ReminderRecord = { ...r, status: "cancelled", reason: "three_saved", at: Date.now() };
          await put(forUser, done).catch(() => {});
          return show(forUser, done);
        }
        // iOS is asked only now, after the person said yes to this reminder.
        let perm = await currentPermission();
        if (!permissionAllowed(perm)) {
          perm = await Notifications.requestPermissionsAsync().catch(() => null);
          trackPermission("notifications", permissionAllowed(perm));
        }
        if (owner.current !== forUser) return;
        if (!permissionAllowed(perm)) {
          const denied: ReminderRecord = { ...r, status: "denied", at: Date.now() };
          await put(forUser, denied).catch(() => {});
          show(forUser, denied);
          setNotice("denied");
          return;
        }
        const fireAt = nextReminderDate(new Date()).getTime();
        const { id: _old, reason: _reason, ...rest } = r;
        const intent: ReminderRecord = { ...rest, status: "scheduling", fireAt, at: Date.now() };
        try { await put(forUser, intent); } catch { throw new Error(SAVE_FAILED); }
        for (const id of (await pendingReminders()) ?? []) await cancelNative(id);  // exactly one on this phone
        let id: string;
        try {
          id = await Notifications.scheduleNotificationAsync({
            content: { title: REMINDER_TITLE, body: REMINDER_BODY, data: { kind: REMINDER_KIND } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
          });
        } catch {
          await put(forUser, r).catch(() => {});
          throw new Error(SAVE_FAILED);
        }
        const done: ReminderRecord = { ...intent, status: "scheduled", id };
        try {
          await put(forUser, done);
        } catch {
          // Couldn't write its id down: take it back rather than leave one we can't find or cancel.
          await cancelNative(id);
          await put(forUser, r).catch(() => {});
          throw new Error(SAVE_FAILED);
        }
        track("onboarding_nudge_scheduled", { slot: "morning" });
        show(forUser, done);
        if (owner.current === forUser) setNotice("set");
      } catch (e) {
        if (owner.current === forUser) setError(e instanceof Error ? e.message : SAVE_FAILED);
      }
    });
    acting.current = false;
    setBusy(false);
  }, [enabled, serial, show]);

  const decline = useCallback(async () => {
    const forUser = owner.current;
    if (!enabled || !forUser) return;
    track("onboarding_nudge_choice", { choice: "declined" });
    await serial(async () => {
      const r = await read(forUser);
      if (r.status !== "unseen") return show(forUser, r);
      const next: ReminderRecord = { ...r, status: "declined", at: Date.now() };
      show(forUser, next);  // hidden even if the write fails
      await put(forUser, next).catch(() => {});
    });
  }, [enabled, serial, show]);

  const turnOff = useCallback(async () => {
    const forUser = owner.current;
    if (!enabled || !forUser) return;
    setError(null);
    setNotice(null);
    await cancelFor(forUser, "opt_out");
  }, [enabled, cancelFor]);

  const forgetAccount = useCallback(async () => {
    const forUser = owner.current;
    if (!forUser) return;
    await serial(async () => {
      const r = await read(forUser);
      if (r.id) await cancelNative(r.id);
      for (const id of (await pendingReminders()) ?? []) await cancelNative(id);
      await AsyncStorage.removeItem(recordKey(forUser)).catch(() => {});
      show(forUser, null);
    });
  }, [serial, show]);

  const noteIntroSeen = useCallback(() => {
    const forUser = owner.current;
    if (!enabled || !forUser) return;
    setIntro(true);
    void serial(async () => {
      const r = await read(forUser);
      if (!r.introSeen) await put(forUser, { ...r, introSeen: true }).catch(() => {});
    });
  }, [enabled, serial]);

  // A tap on one of our notifications: it is this account's only if its id is the one written down here.
  const claimTap = useCallback((identifier: string) => serial(async (): Promise<TapClaim> => {
    const forUser = owner.current;
    if (!enabled || !forUser) return "other";
    const r = await read(forUser);
    if (!r.id || r.id !== identifier) return "other";
    if (r.status !== "scheduled" && r.status !== "expired") return "used";
    const opened: ReminderRecord = { ...r, status: "opened", at: Date.now() };
    await put(forUser, opened).catch(() => {});
    show(forUser, opened);
    track("onboarding_nudge_tapped", { entry: "notification" });
    return "mine";
  }), [enabled, serial, show]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<ReminderValue>(() => {
    const r = record ?? UNSEEN;
    const offerVisible = !!record && shouldOffer({
      enabled, signedIn: !!uid, outfit: !!outfit, savedCount, introSeen: intro || !!record.introSeen, record: r,
    });
    const armable = enabled && !!uid && !!record && !!outfit && record.status !== "unseen" && canArm(record)
      && (savedCount === null || savedCount < FIRST_GOAL);
    return { enabled, record, offerVisible, armable, busy, error, notice, accept, decline, turnOff, dismissNotice,
      noteIntroSeen, forgetAccount, claimTap };
  }, [enabled, record, uid, outfit, savedCount, intro, busy, error, notice, accept, decline, turnOff, dismissNotice,
      noteIntroSeen, forgetAccount, claimTap]);

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}
