import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, type, weight } from "../theme";
import { IconButton } from "../ui";

export type InfoSection = { title: string; body: string[] };

// A plain reading page (Help, Privacy): a glass back button and the title in a top bar, an intro, then
// sections as a heading over long copy. No cards and no blobs: it's for reading.
export function InfoPage({ title, intro, sections, footer, children }: {
  title: string; intro: string; sections: InfoSection[]; footer?: string; children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
        <Text accessibilityRole="header" numberOfLines={1} style={{ ...type.subhead, ...weight(600), color: colors.label, flexShrink: 1 }}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 22 }}>
        <Text style={{ ...type.body, color: colors.secondaryLabel }}>{intro}</Text>
        {sections.map((s) => (
          <View key={s.title} style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={{ ...type.cardTitle, color: colors.label }}>{s.title}</Text>
            {s.body.map((p) => <Text key={p} style={{ ...type.subhead, lineHeight: 22, color: colors.tabInactive }}>{p}</Text>)}
          </View>
        ))}
        {children}
        {footer ? <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{footer}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
