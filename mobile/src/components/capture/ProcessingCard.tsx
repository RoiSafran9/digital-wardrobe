import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { Icon } from "../Icon";
import { colors, radius, type, weight } from "../../theme";
import { Glass, ProgressBar, Shimmer } from "../../ui";
import { PHOTO_BG } from "./FlowChrome";
import { countLines, type JobView } from "../../jobs/jobState";

export type JobKind = "garment" | "outfit";

type Step = { label: string; status: "done" | "now" | "next" };

// Where the job is, in the server's own words: sent, waiting in line, making images (with its real count),
// then saving. Nothing advances on a timer.
export function jobSteps(view: JobView, kind: JobKind): { headline: string; steps: Step[] } {
  const p = view.progress;
  const counted = !!p && p.total > 0;
  const allProcessed = counted && p!.done >= p!.total;
  const finishing = kind === "outfit" ? "Getting them ready for review" : "Saving to your closet";
  const at = view.state === "sending" ? 0
    : view.state === "queued" ? 1
    : view.state === "running" ? (allProcessed ? 3 : 2)
    : 4;
  const making = counted ? `Making catalog images · ${Math.min(p!.done, p!.total)} of ${p!.total}` : "Making catalog images";
  const labels = ["Sending your request", "Waiting for a free spot", making, finishing];
  const steps = labels.map((label, i): Step => ({ label, status: i < at ? "done" : i === at ? "now" : "next" }));
  const headline = view.offline ? "Reconnecting to KIPS"
    : view.state === "sending" ? "Sending your request"
    : view.state === "queued" ? "Waiting for a free spot"
    : view.state === "running" ? (allProcessed ? finishing : counted ? "Making catalog images" : "Working on it")
    : view.state === "succeeded" ? (kind === "outfit" ? "Ready for review" : "Done")
    : "Stopped";
  return { headline, steps };
}

// Long server work, shown as it really is: the photo under a shimmer, the server's status as the title, a
// bar only when the server has counted the pieces (processed of total, and how many got an image), otherwise
// a spinner — never a percentage made up from time. Laid out like the handoff's processing screen: the photo
// panel, the title, the bar, then a glass checklist (done = green check, current = spinner, next = empty ring).
export function ProcessingCard({ photoUri, title, note, view, kind = "garment" }: {
  photoUri: string; title: string; note: string; view: JobView; kind?: JobKind;
}) {
  const { headline, steps } = jobSteps(view, kind);
  const counts = countLines(view.progress);
  const p = view.progress;
  const working = view.state !== "succeeded" && view.state !== "failed";
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={{ height: 300, borderRadius: radius.hero, backgroundColor: PHOTO_BG, overflow: "hidden" }}>
        {photoUri ? <Image source={{ uri: photoUri }} blurRadius={working ? 12 : 0} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <Shimmer active={working} />
        {p && p.total > 0 ? (
          <Glass testID="piece-count" radius={radius.pill} level="base" style={{ position: "absolute", top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ ...type.footnote, ...weight(700), color: colors.label, fontVariant: ["tabular-nums"] }}>{counts?.done}</Text>
          </Glass>
        ) : null}
      </View>

      <View accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={{ ...type.pageTitle, color: colors.label, marginTop: 18 }}>{`${headline}${working ? "…" : ""}`}</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 4 }}>{title}</Text>
        {view.offline ? (
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 4 }}>
            Can't reach the server right now. Your request is safe — it won't be sent or charged twice.
          </Text>
        ) : null}
      </View>
      <View style={{ marginTop: 12, minHeight: 20, justifyContent: "center" }}>
        {p && p.total > 0
          ? <ProgressBar value={Math.min(p.done, p.total) / p.total} height={8} accessibilityLabel={counts?.done} />
          : working ? <ActivityIndicator accessibilityLabel={headline} color={colors.tint} style={{ alignSelf: "flex-start" }} /> : null}
      </View>
      {counts?.made ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 6, fontVariant: ["tabular-nums"] }}>{counts.made}</Text> : null}

      <Glass radius={radius.tile} style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 6 }}>
        {steps.map((s, i) => (
          <View key={i} accessible accessibilityLabel={`${s.label}${s.status === "done" ? ", done" : s.status === "now" ? ", in progress" : ""}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.separator }}>
            <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
              {s.status === "done" ? <Icon name="check" size={20} color={colors.success} />
                : s.status === "now" ? <ActivityIndicator size="small" color={colors.tint} />
                : <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.separatorStrong }} />}
            </View>
            <Text style={{ ...type.callout, color: s.status === "next" ? colors.secondaryLabel : colors.label }}>{s.label}</Text>
          </View>
        ))}
      </Glass>
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", marginTop: 14, paddingHorizontal: 12 }}>{note}</Text>
    </View>
  );
}
