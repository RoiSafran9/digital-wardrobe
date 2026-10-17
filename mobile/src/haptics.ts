import * as Haptics from "expo-haptics";

// Confirm what the user did, quietly. Never let a missing haptics engine throw.
export const haptics = {
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  light: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  selection: () => { Haptics.selectionAsync().catch(() => {}); },
};
