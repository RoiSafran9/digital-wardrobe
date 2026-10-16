import { Tabs } from "expo-router";
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from "@expo-google-fonts/fraunces";
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
  const [fontsLoaded] = useFonts({ Fraunces_400Regular, Fraunces_400Regular_Italic });
  if (!fontsLoaded) {
    return null;  // a blink at launch beats titles reflowing from a fallback face
  }
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
        <Tabs.Screen name="closet" options={{ title: "Closet", tabBarIcon: tabIcon("grid-outline") }} />
      </Tabs>
    </LastRunProvider>
  );
}
