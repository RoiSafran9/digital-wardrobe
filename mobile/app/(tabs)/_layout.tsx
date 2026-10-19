import { useCallback } from "react";
import { Tabs, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { StyleSheet, View, type ColorValue } from "react-native";
import { Icon, type IconName } from "../../src/components/Icon";
import { useAuth } from "../../src/auth/AuthProvider";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useNameStep, useStarterCredits } from "../../src/onboarding";
import { useProfile } from "../../src/profile";
import { colors, TAB_BAR_HEIGHT, type } from "../../src/theme";

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} size={size} color={color} />;
}

// The handoff's tab bar: 84pt, translucent blur, hairline top, floating over content (every tab screen
// ends its scroll TAB_BAR_HEIGHT above the bottom). Inactive tabs use the secondary label color (the
// handoff's lighter grey fails 4.5:1 for the labels).
function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={20} tint="systemChromeMaterial" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { userId, status } = useAuth();
  const { billing, credits } = useCredits();
  const { profile, loaded } = useProfile();
  const askName = useCallback(() => router.push("/your-name"), [router]);
  const named = useNameStep(status === "signedIn", loaded, profile?.display_name, askName);
  const showStarter = useCallback(() => router.push("/welcome-credits"), [router]);
  useStarterCredits(userId, billing, credits, showStarter, named);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.secondaryLabel,
        tabBarStyle: { position: "absolute", height: TAB_BAR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, backgroundColor: "transparent" },
        tabBarBackground: TabBarBackground,
        tabBarLabelStyle: type.tabLabel,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="closet" options={{ title: "Closet", tabBarIcon: tabIcon("closet") }} />
      <Tabs.Screen name="add" options={{ title: "Add", tabBarIcon: tabIcon("plusCircle") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("account") }} />
    </Tabs>
  );
}
