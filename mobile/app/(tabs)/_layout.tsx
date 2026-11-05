import { useCallback } from "react";
import { Tabs, useRouter } from "expo-router";
import { TabBar } from "../../src/components/TabBar";
import { useToast } from "../../src/ui";
import { useAuth } from "../../src/auth/AuthProvider";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useNameStep, useStarterCredits } from "../../src/onboarding";
import { useFirstPiecesMaybe } from "../../src/firstPieces/FirstPiecesProvider";
import { markOffered, useFirstPiecesOffer } from "../../src/firstPieces/offer";
import { useProfile } from "../../src/profile";

// Home · Closet · [camera] · Looks · Me as a floating glass capsule (src/components/TabBar.tsx); every tab
// screen ends its scroll TAB_BAR_HEIGHT above the bottom. Add is no longer a tab: the center camera and
// Home's Add card replace it, and the route stays for the flows that link to it. Looks is always in the
// bar; where Build My Look isn't offered (local mode, server flag off) it says so instead of opening.

export default function TabsLayout() {
  const router = useRouter();
  const toast = useToast();
  const { userId, status } = useAuth();
  const { billing, credits, generation, outfitBuilder } = useCredits();
  const firstPieces = useFirstPiecesMaybe();
  const { profile, loaded } = useProfile();
  const askName = useCallback(() => router.push("/your-name"), [router]);
  const named = useNameStep(status === "signedIn", loaded, profile?.display_name, askName);
  const showStarter = useCallback(() => {
    if (userId) void markOffered(userId);  // its button leads into First 3 Pieces
    router.push("/welcome-credits");
  }, [router, userId]);
  const starterDecided = useStarterCredits(userId, billing, credits, showStarter, named);
  const openFirstPieces = useCallback(() => router.push({ pathname: "/first-pieces", params: { entry: "auto" } }), [router]);
  useFirstPiecesOffer({ userId, signedIn: status === "signedIn", named, starterDecided, generation: generation !== false,
                        loaded: !!credits, inflight: !!firstPieces?.round, open: openFirstPieces });
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          {...props}
          onCamera={() => router.push("/capture/camera")}  // no type: the camera offers Garments / Outfit
          onLooks={() => (status === "signedIn" && outfitBuilder
            ? router.push("/build-my-look")
            : toast.show(status === "signedIn" ? "Build My Look isn't available yet." : "Build My Look needs a signed-in account."))}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="closet" options={{ title: "Closet" }} />
      <Tabs.Screen name="add" options={{ title: "Add", href: null }} />
      <Tabs.Screen name="account" options={{ title: "Me" }} />
    </Tabs>
  );
}
