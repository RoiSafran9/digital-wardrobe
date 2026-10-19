import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getProfile, setDisplayName } from "./api/client";
import type { Profile } from "./api/v1";
import { useAuth } from "./auth/AuthProvider";

export const NAME_MAX = 40;

type Value = {
  profile: Profile | null;  // null until loaded, and in local mode
  loaded: boolean;
  saveName: (name: string) => Promise<void>;
};

const ProfileContext = createContext<Value>({ profile: null, loaded: false, saveName: async () => {} });
export const useProfile = () => useContext(ProfileContext);

export const validName = (name: string) => {
  const n = name.trim();
  return n.length >= 1 && n.length <= NAME_MAX;
};

// The signed-in person's profile: their email and the name they chose at sign-up. Forgotten when the
// account changes, like credits.
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { status, userId } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const owner = useRef<string | null>(null);
  owner.current = status === "signedIn" ? userId : null;

  useEffect(() => {
    setProfile(null);
    setLoaded(false);
    const forUser = owner.current;
    if (!forUser) return;
    // After AuthProvider (our parent) points the API at the account in its own effect.
    const timer = setTimeout(() => {
      getProfile()
        .then((p) => { if (owner.current === forUser) { setProfile(p); setLoaded(true); } })
        .catch(() => { if (owner.current === forUser) setLoaded(true); });
    }, 0);
    return () => clearTimeout(timer);
  }, [status, userId]);

  const saveName = useCallback(async (name: string) => {
    const updated = await setDisplayName(name.trim());
    setProfile(updated);
  }, []);

  return <ProfileContext.Provider value={{ profile, loaded, saveName }}>{children}</ProfileContext.Provider>;
}
