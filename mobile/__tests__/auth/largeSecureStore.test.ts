import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { LargeSecureStore } from "../../src/auth/largeSecureStore";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
  };
});
let mockSeed = 0;
jest.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + mockSeed++) % 256),
}));

const keychain: Map<string, string> = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const KEY = "sb-abc-auth-token";
const SESSION = JSON.stringify({ access_token: "a".repeat(1500), refresh_token: "r".repeat(40), user: { email: "a@b.com" } });

beforeEach(async () => {
  keychain.clear();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test("round-trips a session larger than the Keychain's 2048-byte limit", async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, SESSION);
  expect(await store.getItem(KEY)).toBe(SESSION);
});

test("only ciphertext reaches AsyncStorage; the key is in the Keychain, this device only", async () => {
  await new LargeSecureStore().setItem(KEY, SESSION);
  const stored = await AsyncStorage.getItem(KEY);
  expect(stored).toBeTruthy();
  expect(stored).not.toContain("access_token");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, expect.stringMatching(/^[0-9a-f]{64}$/), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
});

test("removeItem clears both halves", async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, SESSION);
  await store.removeItem(KEY);
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
  expect(keychain.has(KEY)).toBe(false);
  expect(await store.getItem(KEY)).toBeNull();
});

test("a missing Keychain key reads as no session and drops the orphaned ciphertext", async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, SESSION);
  keychain.delete(KEY);
  expect(await store.getItem(KEY)).toBeNull();
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
});

test.each(["not hex at all", "abcd1234", ""])("garbled ciphertext %p reads as no session and is cleared", async (bad) => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, SESSION);
  await AsyncStorage.setItem(KEY, bad);
  expect(await store.getItem(KEY)).toBeNull();
  expect(keychain.has(KEY)).toBe(false);
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
});

test("each write uses a fresh encryption key", async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, SESSION);
  const first = keychain.get(KEY);
  await store.setItem(KEY, SESSION);
  expect(keychain.get(KEY)).not.toBe(first);
  expect(await store.getItem(KEY)).toBe(SESSION);
});
