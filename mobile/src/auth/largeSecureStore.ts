import AsyncStorage from "@react-native-async-storage/async-storage";
import * as aesjs from "aes-js";
import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// Supabase's recommended Expo session storage: the Keychain can't hold values over 2048 bytes,
// so each write gets a fresh AES-256 key kept in the Keychain (this device only), and the
// encrypted session goes to AsyncStorage. Anything unreadable counts as "no session".
const KEYCHAIN = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const HEX = /^(?:[0-9a-f]{2})+$/;

export class LargeSecureStore {
  async getItem(key: string): Promise<string | null> {
    const [hexKey, ciphertext] = await Promise.all([SecureStore.getItemAsync(key, KEYCHAIN), AsyncStorage.getItem(key)]);
    if (hexKey === null && ciphertext === null) return null;
    const value = hexKey && ciphertext ? decrypt(hexKey, ciphertext) : null;
    if (value === null) await this.removeItem(key);
    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = getRandomBytes(32);
    const ctr = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    // The envelope lets a read tell a real value from garbage decrypted with the wrong key.
    const ciphertext = ctr.encrypt(aesjs.utils.utf8.toBytes(JSON.stringify({ v: value })));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey), KEYCHAIN);
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(ciphertext));
  }

  async removeItem(key: string): Promise<void> {
    await Promise.all([SecureStore.deleteItemAsync(key, KEYCHAIN), AsyncStorage.removeItem(key)]);
  }
}

function decrypt(hexKey: string, ciphertext: string): string | null {
  if (!HEX.test(hexKey) || hexKey.length !== 64 || !HEX.test(ciphertext)) return null;
  try {
    const ctr = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(hexKey), new aesjs.Counter(1));
    const envelope = JSON.parse(aesjs.utils.utf8.fromBytes(ctr.decrypt(aesjs.utils.hex.toBytes(ciphertext))));
    return typeof envelope?.v === "string" ? envelope.v : null;
  } catch {
    return null;
  }
}
