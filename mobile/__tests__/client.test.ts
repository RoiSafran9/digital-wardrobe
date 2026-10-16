import { File } from "expo-file-system";
import { postRun, getItems, imageUrl, updateItem, deleteItem, API_BASE_URL } from "../src/api/client";

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri, name: "fake.jpg", type: "image/jpeg" })),
}));

describe("postRun", () => {
  afterEach(() => {
    (global.fetch as jest.Mock).mockReset();
    jest.restoreAllMocks();
  });

  test("uploads the photo as an expo-file-system File, not an RN {uri} object", async () => {
    // Expo's global fetch (expo/fetch) rejects RN-style {uri, name, type} FormData parts.
    const appendSpy = jest.spyOn(FormData.prototype, "append");
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    await postRun("file:///fake.jpg");

    expect(File).toHaveBeenCalledWith("file:///fake.jpg");
    const fileInstance = (File as unknown as jest.Mock).mock.results[0].value;
    expect(appendSpy).toHaveBeenCalledWith("photo", fileInstance);
  });

  test("parses a successful run response", async () => {
    const fakeRun = { run_id: "r1", quality: { status: "ok", reason: null }, items: [], failed: [] };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fakeRun });

    const result = await postRun("file:///fake.jpg");
    expect(result).toEqual(fakeRun);
  });

  test("throws the server's error message on a non-2xx response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "no photo provided" }),
    });

    await expect(postRun("file:///fake.jpg")).rejects.toThrow("no photo provided");
  });

  test("throws a readable message when the network request fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    await expect(postRun("file:///fake.jpg")).rejects.toThrow("can't reach server");
  });
});

describe("getItems", () => {
  afterEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  test("parses the items list", async () => {
    const fakeItems = { items: [] };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fakeItems });
    const result = await getItems();
    expect(result).toEqual(fakeItems);
  });

  test("throws a readable message when the network request fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    await expect(getItems()).rejects.toThrow("can't reach server");
  });
});

describe("imageUrl", () => {
  test("prefixes the server address and encodes spaces in the path", () => {
    expect(imageUrl("/images/r1/My Photo/item_0/generated.png")).toBe(
      `${API_BASE_URL}/images/r1/My%20Photo/item_0/generated.png`
    );
  });
});

const closetItem = {
  run_id: "r1", photo_name: "My Photo", item_id: "item_0", tier: "high" as const,
  facts: {} as any, crop_url: "", generated_url: "",
};

describe("updateItem", () => {
  afterEach(() => (global.fetch as jest.Mock).mockReset());

  test("PATCHes the encoded item path with the changed fields", async () => {
    const updated = { ...closetItem, tier: "high" };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => updated });
    const result = await updateItem(closetItem, { category: "fleece" });
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/items/r1/My%20Photo/item_0`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "fleece" }),
    });
    expect(result).toEqual(updated);
  });

  test("throws the server's validation message", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "category can't be empty" }) });
    await expect(updateItem(closetItem, { category: " " })).rejects.toThrow("category can't be empty");
  });
});

describe("deleteItem", () => {
  afterEach(() => (global.fetch as jest.Mock).mockReset());

  test("DELETEs the item and resolves on 204", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    await deleteItem(closetItem);
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/items/r1/My%20Photo/item_0`, { method: "DELETE" });
  });

  test("throws a readable message when the server is unreachable", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    await expect(deleteItem(closetItem)).rejects.toThrow("can't reach server");
  });
});
