import AsyncStorage from "@react-native-async-storage/async-storage";

// The first-success popup shows once per account on this device.
export const celebratedKey = (userId: string) => `firstPieces.celebrated.${userId}`;

export async function wasCelebrated(userId: string | null): Promise<boolean> {
  if (!userId) return true;
  return (await AsyncStorage.getItem(celebratedKey(userId)).catch(() => null)) === "1";
}

export async function markCelebrated(userId: string | null): Promise<void> {
  if (userId) await AsyncStorage.setItem(celebratedKey(userId), "1").catch(() => {});
}

// Ids passed to the closet in the route (`celebrate=1&ids=a,b`).
export const idsParam = (ids: string[]) => ids.join(",");
export const parseIds = (raw: string | undefined) => (raw ? raw.split(",").filter(Boolean) : []);
