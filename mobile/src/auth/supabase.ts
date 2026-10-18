import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LargeSecureStore } from "./largeSecureStore";

export function createSupabase({ url, publishableKey }: { url: string; publishableKey: string }): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: {
      storage: new LargeSecureStore(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

// Refresh tokens only while the app is in the foreground, as Supabase recommends for React Native.
export function watchAppState(client: SupabaseClient): () => void {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
  return () => sub.remove();
}
