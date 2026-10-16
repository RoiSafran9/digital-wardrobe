import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { LastRunProvider } from "../src/store/lastRun";
import { colors } from "../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={color} />;
}

export default function RootLayout() {
  return (
    <LastRunProvider>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
          tabBarLabelStyle: { fontSize: 11 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Add", tabBarIcon: tabIcon("camera-outline") }} />
        <Tabs.Screen name="results" options={{ title: "New", tabBarIcon: tabIcon("sparkles-outline") }} />
        <Tabs.Screen name="closet" options={{ title: "Closet", tabBarIcon: tabIcon("grid-outline") }} />
      </Tabs>
    </LastRunProvider>
  );
}
