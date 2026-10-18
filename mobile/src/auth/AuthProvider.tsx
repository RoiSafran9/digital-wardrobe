import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { authConfig, type AuthConfig } from "./config";
import { authErrorMessage, normalizeEmail } from "./messages";
import { createSupabase, watchAppState } from "./supabase";

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "local" | "unconfigured";

export type AuthContextValue = {
  status: AuthStatus;
  email: string | null;
  userId: string | null;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
};

type AuthClient = Pick<SupabaseClient, "auth">;
type State = { status: AuthStatus; email: string | null; userId: string | null };

const noop = async () => {};
export const AuthContext = createContext<AuthContextValue>({
  status: "loading", email: null, userId: null, sendCode: noop, verifyCode: noop, signOut: noop,
});

export const useAuth = () => useContext(AuthContext);

const fromSession = (session: Session | null): State =>
  session ? { status: "signedIn", email: session.user.email ?? null, userId: session.user.id } : { status: "signedOut", email: null, userId: null };

export function AuthProvider({ children, config = authConfig, client: injected }: {
  children: React.ReactNode; config?: AuthConfig; client?: AuthClient;
}) {
  const client = useMemo<AuthClient | null>(
    () => (config.mode === "supabase" ? injected ?? createSupabase(config) : null),
    [config, injected],
  );
  const [state, setState] = useState<State>(() => ({
    status: config.mode === "supabase" ? "loading" : config.mode, email: null, userId: null,
  }));

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.auth.getSession().then(({ data }) => { if (live) setState(fromSession(data.session)); });
    const { data } = client.auth.onAuthStateChange((_event, session) => { if (live) setState(fromSession(session)); });
    const stopWatching = injected ? () => {} : watchAppState(client as SupabaseClient);
    return () => { live = false; data.subscription.unsubscribe(); stopWatching(); };
  }, [client, injected]);

  const sendCode = useCallback(async (email: string) => {
    if (!client) return;
    const { error } = await client.auth.signInWithOtp({ email: normalizeEmail(email) });
    if (error) throw new Error(authErrorMessage(error));
  }, [client]);

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!client) return;
    const { data, error } = await client.auth.verifyOtp({ email: normalizeEmail(email), token: code, type: "email" });
    if (error) throw new Error(authErrorMessage(error));
    setState(fromSession(data.session));
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    // Offline or server trouble: still forget the session on this device.
    if (error) await client.auth.signOut({ scope: "local" });
    setState(fromSession(null));
  }, [client]);

  const value = useMemo(() => ({ ...state, sendCode, verifyCode, signOut }), [state, sendCode, verifyCode, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
