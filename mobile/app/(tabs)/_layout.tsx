import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Icon, type IconName } from "../../src/components/Icon";
import { colors } from "../../src/theme";

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.secondaryLabel,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.separator },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="closet" options={{ title: "Closet", tabBarIcon: tabIcon("closet") }} />
      <Tabs.Screen name="add" options={{ title: "Add", tabBarIcon: tabIcon("camera") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("account") }} />
    </Tabs>
  );
}
