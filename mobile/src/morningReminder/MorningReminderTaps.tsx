import { useCallback, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { getItems } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useCredits } from "../credits/CreditsProvider";
import { markOffered } from "../firstPieces/offer";
import { FIRST_GOAL } from "../firstPieces/round";
import { useMorningReminder } from "./MorningReminderProvider";
import { isReminderData } from "./schedule";

// How long a tap waits for the server's flags before opening First 3 Pieces anyway (its screen adapts).
export const FLAGS_WAIT_MS = 5000;
export const REMINDER_ROUTE = { pathname: "/first-pieces", params: { entry: "reminder", photoType: "worn" } } as const;

// The identifier of a tap on the morning reminder (the plain tap, not a dismiss), else null.
export function reminderTapId(r: Notifications.NotificationResponse | null | undefined): string | null {
  if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  const request = r.notification?.request;
  return request && isReminderData(request.content?.data) ? request.identifier : null;
}

function lastResponse(): Notifications.NotificationResponse | null {
  try { return Notifications.getLastNotificationResponse(); } catch { return null; }
}

// Taps on the morning reminder, from a running app or one it launched. Each tap is handled once: after
// sign-in has settled and the navigator is mounted, and only for the account whose reminder it was.
// Then First 3 Pieces opens with "Someone wearing them" chosen and Take Photo / Choose from Library shown —
// no camera, picker, scan or paid work starts by itself. Three saved pieces or no outfit photos: Home.
// Job-result pushes and other notifications are left alone.
export function MorningReminderTaps() {
  const nav = useRootNavigationState();
  const navReady = !!nav?.key;
  const { status, userId } = useAuth();
  const { credits, outfit } = useCredits();
  const { claimTap } = useMorningReminder();
  const handled = useRef(new Set<string>());
  const pending = useRef<string | null>(null);
  const [tick, setTick] = useState(0);
  const [waitedOut, setWaitedOut] = useState(false);
  const signedInAs = useRef<string | null>(null);
  signedInAs.current = status === "signedIn" ? userId : null;

  const receive = useCallback((r: Notifications.NotificationResponse | null) => {
    const id = reminderTapId(r);
    if (!id || handled.current.has(id)) return;
    handled.current.add(id);
    pending.current = id;
    try { Notifications.clearLastNotificationResponse(); } catch { /* an older native build */ }
    setWaitedOut(false);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    receive(lastResponse());  // the tap that launched the app
    const sub = Notifications.addNotificationResponseReceivedListener(receive);
    return () => sub.remove();
  }, [receive]);

  // Don't wait forever for the server's flags (the Mac may be offline).
  useEffect(() => {
    if (!pending.current || credits) return;
    const t = setTimeout(() => setWaitedOut(true), FLAGS_WAIT_MS);
    return () => clearTimeout(t);
  }, [tick, credits]);

  useEffect(() => {
    const id = pending.current;
    if (!id || !navReady || status === "loading") return;
    if (status === "local" || status === "unconfigured") { pending.current = null; return; }
    if (status !== "signedIn" || !userId) return;  // signed out: Welcome / Sign In first, then decide
    if (!credits && !waitedOut) return;
    pending.current = null;
    const forUser = userId;
    const outfitOn = credits ? !!outfit : true;  // unknown: First 3 Pieces shows what's available
    void (async () => {
      const claim = await claimTap(id);
      if (claim === "used") return;  // an old tap: don't take over an ordinary launch
      if (claim === "other") { router.navigate("/"); return; }  // not this account's reminder
      await markOffered(forUser);  // so First 3 Pieces doesn't also open by itself
      let saved: number | null = null;
      try { saved = (await getItems()).items.length; } catch { /* offline: its screens show the errors */ }
      if (signedInAs.current !== forUser) return;  // signed out or switched meanwhile
      if (saved !== null && saved >= FIRST_GOAL) { router.navigate("/"); return; }
      if (!outfitOn) { router.navigate("/"); return; }
      router.push(REMINDER_ROUTE);
    })().catch(() => {});
  }, [tick, navReady, status, userId, credits, outfit, waitedOut, claimTap]);

  return null;
}
