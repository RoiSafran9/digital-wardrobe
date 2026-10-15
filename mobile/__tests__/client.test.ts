import { postRun, getItems } from "../src/api/client";

describe("postRun", () => {
  afterEach(() => {
    (global.fetch as jest.Mock).mockReset();
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
