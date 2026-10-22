import React, { useEffect } from "react";
import { track, type Action } from "../activity/track";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCredits } from "../credits/CreditsProvider";
import { ASK_FOR_MORE } from "../credits/credits";
import { colors, type } from "../theme";
import { Button } from "./Button";
import { ProgressBar } from "./ProgressBar";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  needed: number;
  onClose: () => void;
  onAdjust?: () => void;  // when the user can lower the cost (deselect pieces)
  body?: string;  // the contextual sentence, e.g. "Deselect 2 garments to continue with what you have."
  action?: Action;  // for the activity record
};

// Not enough credits for what the user asked. No purchase: the wardrobe stays usable and the owner
// tops up by hand.
export function InsufficientCreditsSheet({ visible, needed, onClose, onAdjust, body, action }: Props) {
  const router = useRouter();
  useEffect(() => { if (visible) track("out_of_credits_shown", { action }); }, [visible, action]);
  const { credits } = useCredits();
  const available = credits?.available ?? 0;
  const left = `You have ${available === 1 ? "1 credit" : `${available} credits`} left.`;
  return (
    <Sheet visible={visible} onClose={onClose} floating>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <Text style={{ ...type.balance, color: colors.label }}>{available}</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel }}>{`/ ${needed} credits needed`}</Text>
      </View>
      <View style={{ marginVertical: 14 }}>
        <ProgressBar value={needed ? available / needed : 0} warning accessibilityLabel="Credits available against needed" />
      </View>
      <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Not enough credits</Text>
      <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 6, marginBottom: 20 }}>
        {[left, body, ASK_FOR_MORE].filter(Boolean).join(" ")}
      </Text>
      <View style={{ gap: 6 }}>
        {onAdjust ? <Button title="Adjust Selection" onPress={onAdjust} /> : <Button title="OK" onPress={onClose} />}
        <Button title="View Price List" variant="text" onPress={() => { onClose(); router.push("/account"); }} />
      </View>
    </Sheet>
  );
}
