import React from "react";
import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { Icon, type IconName } from "./Icon";
import { Breathe } from "../motion/Breathe";
import { haptics } from "../haptics";
import { Glass } from "../ui/Glass";
import { colors, radius, shadow, type } from "../theme";

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: "Home", icon: "home", active: "homeFill" },
  closet: { label: "Closet", icon: "closet", active: "closetFill" },
  account: { label: "Me", icon: "account", active: "accountFill" },
};

type Extra = { onCamera: () => void; onLooks: () => void };

function Item({ label, icon, selected, onPress, testID }: { label: string; icon: IconName; selected: boolean; onPress: () => void; testID?: string }) {
  const color = selected ? colors.tint : colors.tabInactive;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "center", gap: 2 }}
    >
      <Icon name={icon} size={23} color={color} />
      <Text style={{ ...type.tabLabel, color }}>{label}</Text>
    </Pressable>
  );
}

// The floating glass capsule: Home · Closet · [camera] · Looks · Me. The raised center camera is not a
// tab: it opens the camera in garment mode. Looks opens Build My Look (always shown).
export function TabBar({ state, emitter, navigateToTab, onCamera, onLooks }: BottomTabBarProps & Extra) {
  const go = (focused: boolean, key: string) => () => {
    const event = emitter.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      haptics.selection();
      navigateToTab(key);
    }
  };
  const route = (name: string) => {
    const i = state.routes.findIndex((r) => r.name === name);
    const r = state.routes[i];
    if (!r) return null;
    const tab = TABS[name];
    const focused = state.index === i;
    return <Item key={name} testID={`tab-${name}`} label={tab.label} icon={focused ? tab.active : tab.icon} selected={focused} onPress={go(focused, r.key)} />;
  };
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: 26 }}>
      <Glass radius={radius.pill} level="base" style={{ height: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
        {route("index")}
        {route("closet")}
        <View style={{ flex: 1.2, alignItems: "center" }}>
          <Pressable onPress={() => { haptics.selection(); onCamera(); }} accessibilityRole="button" accessibilityLabel="Add clothes" testID="tab-camera" style={{ marginTop: -26 }}>
            <Breathe style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: "rgba(255,255,255,0.85)", ...shadow.camera }}>
              <Icon name="camera" size={30} color="#FFFFFF" />
            </Breathe>
          </Pressable>
        </View>
        <Item testID="tab-looks" label="Looks" icon="sparkles" selected={false} onPress={() => { haptics.selection(); onLooks(); }} />
        {route("account")}
      </Glass>
    </View>
  );
}
