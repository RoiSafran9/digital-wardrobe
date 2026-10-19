import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, radius, type } from "../theme";
import { BackButton } from "../ui";

export type InfoSection = { title: string; body: string[] };

// A plain reading page (Help, Privacy): a title, an intro and grouped sections.
export function InfoPage({ title, intro, sections, footer, children }: {
  title: string; intro: string; sections: InfoSection[]; footer?: string; children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.grouped }}>
      <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 20 }}>
        <BackButton label="Account" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 18 }}>
        <View style={{ paddingHorizontal: 4, gap: 6 }}>
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>{title}</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{intro}</Text>
        </View>
        {sections.map((s) => (
          <View key={s.title} style={{ backgroundColor: colors.card, borderRadius: radius.list, padding: 16, gap: 8 }}>
            <Text accessibilityRole="header" style={{ ...type.headline, color: colors.label }}>{s.title}</Text>
            {s.body.map((p) => <Text key={p} style={{ ...type.subhead, color: colors.secondaryLabel }}>{p}</Text>)}
          </View>
        ))}
        {children}
        {footer ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, paddingHorizontal: 4 }}>{footer}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
