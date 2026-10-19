import { API_BASE_URL, OUTFIT_NEEDS_ACCOUNT, addBack, configureApi, deleteItem, generateOutfit, getCredits, getItems, getOutfitScan, getPendingItems, getPrices, getTurn, imageUrl, keepItem, postRun, scanOutfit, startTurn, updateItem } from "../src/api/client";
import { NO_CREDITS, SCAN_EXPIRED } from "../src/api/v1";
import { addedLabel } from "../src/theme";

jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation((uri: string) => ({ uri })) }));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `key-${++mockUuid}` }));

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const FACTS = { category: f("hoodie"), colors: f(["gray"]), pattern: f("solid"), visible_text: f(""), trims: f(""),
                visible_parts: f([]), occluded_parts: f([]) };
const v1Item = (id: string, extra: object = {}) => ({
  id, created_at: "2026-10-18T09:30:00+00:00", tier: "high", facts: FACTS,
  crop_url: `https://sb.test/${id}/crop.png?token=t`, generated_url: `https://sb.test/${id}/generated.png?token=t`,
  cutout_url: null, back: null, turn: null, ...extra,
});
const job = (status: string, extra: object = {}) => ({ id: "job-1", kind: "garment", status, error: null, item_id: null,
                                                        item_ids: [], quality: null, failed: [], ...extra });

type Route = (init: RequestInit) => { status?: number; body: unknown } | Promise<never>;
let routes: Record<string, Route[]>;
const calls: { url: string; init: RequestInit }[] = [];

function on(method: string, path: string, ...responses: Route[]) {
  routes[`${method} ${path}`] = responses;
}
const reply = (body: unknown, status = 200): Route => () => ({ status, body });

beforeEach(() => {
  routes = {};
  calls.length = 0;
  mockUuid = 0;
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = `${init.method ?? "GET"} ${url.replace(API_BASE_URL, "")}`;
    const queue = routes[key];
    if (!queue?.length) throw new Error(`unexpected ${key}`);
    const { status = 200, body } = await (queue.length > 1 ? queue.shift()! : queue[0])(init);
    return { ok: status < 400, status, json: async () => body } as Response;
  }) as jest.Mock;
});
afterEach(() => {
  configureApi(null);
  jest.useRealTimers();
});

const onUnauthorized = jest.fn();
function signIn(token = "tok-a") {
  configureApi({ getToken: async () => token, onUnauthorized });
}
const auth = (i: number) => (calls[i].init.headers as Record<string, string>)?.Authorization;

test("local mode keeps today's endpoints and sends no token", async () => {
  on("GET", "/items", reply({ items: [] }));
  await getItems();
  expect(calls[0].url).toBe(`${API_BASE_URL}/items`);
  expect(calls[0].init.headers).toBeUndefined();
});

test("signed in: items come from /v1 with the token, adapted to the closet shape", async () => {
  signIn();
  on("GET", "/v1/items", reply({ items: [v1Item("i1")] }));
  const { items } = await getItems();
  expect(auth(0)).toBe("Bearer tok-a");
  expect(items[0]).toMatchObject({ id: "i1", item_id: "i1", photo_name: "", tier: "high" });
  expect(addedLabel(items[0].run_id)).toMatch(/^Added Oct 1[78]$/);  // local date of 09:30 UTC
});

test("signed image URLs are used as they are", () => {
  expect(imageUrl("https://sb.test/a.png?token=x")).toBe("https://sb.test/a.png?token=x");
  expect(imageUrl("/images/r/p/item_0/generated.png")).toBe(`${API_BASE_URL}/images/r/p/item_0/generated.png`);
});

test("a capture becomes a job that is polled until its pieces are ready", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/jobs", reply(job("queued"), 202));
  on("GET", "/v1/jobs/job-1", reply(job("running")),
     reply(job("succeeded", { item_ids: ["i2", "i1"], quality: { status: "ok", reason: null }, failed: [] })));
  on("GET", "/v1/items", reply({ items: [v1Item("i1"), v1Item("i2"), v1Item("old")] }));
  const pending = postRun("file:///p.jpg");
  await jest.advanceTimersByTimeAsync(4000);
  const run = await pending;
  expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  expect(run.items.map((i) => i.item_id)).toEqual(["i2", "i1"]);
  expect(run.quality.status).toBe("ok");
  expect(addedLabel(run.run_id)).toMatch(/^Added /);
});

test("a failed job shows the server's sentence", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/jobs", reply(job("queued"), 202));
  on("GET", "/v1/jobs/job-1", reply(job("failed", { error: "The photo is blurry — hold still and try again" })));
  const pending = expect(postRun("file:///p.jpg")).rejects.toThrow("The photo is blurry — hold still and try again");
  await jest.advanceTimersByTimeAsync(2000);
  await pending;
});

test("a POST that never got an answer is retried once with the same key", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/jobs", () => Promise.reject(new TypeError("Network request failed")), reply(job("queued"), 200));
  on("GET", "/v1/jobs/job-1", reply(job("succeeded", { item_ids: [] })));
  on("GET", "/v1/items", reply({ items: [] }));
  const pending = postRun("file:///p.jpg");
  await jest.advanceTimersByTimeAsync(2000);
  await pending;
  const keys = calls.filter((c) => c.init.method === "POST").map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"]);
  expect(keys).toEqual(["key-1", "key-1"]);
});

test("retake-only pieces count as pieces that couldn't be processed", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/jobs", reply(job("queued"), 202));
  on("GET", "/v1/jobs/job-1", reply(job("succeeded", { item_ids: [], failed: ["item_2"], retakes: [{ piece_index: 1 }] })));
  on("GET", "/v1/items", reply({ items: [] }));
  const pending = postRun("file:///p.jpg");
  await jest.advanceTimersByTimeAsync(2000);
  expect((await pending).failed).toHaveLength(2);
});

test("an expired session signs out with a clear message", async () => {
  signIn();
  on("GET", "/v1/items", reply({ error: "sign in again" }, 401));
  await expect(getItems()).rejects.toThrow("Your session expired. Sign in again.");
  expect(onUnauthorized).toHaveBeenCalled();
});

test("a server still in local mode gets a setup hint", async () => {
  signIn();
  on("GET", "/v1/items", reply({ detail: "Not Found" }, 404));
  await expect(getItems()).rejects.toThrow("Your wardrobe server isn't in account mode. Restart it with WARDROBE_AUTH=on.");
});

test("signing out mid-poll stops polling and never reuses the old token", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/jobs", reply(job("queued"), 202));
  on("GET", "/v1/jobs/job-1", reply(job("running")));
  const pending = expect(postRun("file:///p.jpg")).rejects.toThrow("You signed out.");
  await jest.advanceTimersByTimeAsync(2000);
  const before = calls.length;
  configureApi(null);
  await jest.advanceTimersByTimeAsync(10_000);
  await pending;
  expect(calls.length).toBe(before);
});

test("polling gives up after five minutes", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/jobs", reply(job("queued"), 202));
  on("GET", "/v1/jobs/job-1", reply(job("running")));
  const pending = expect(postRun("file:///p.jpg")).rejects.toThrow("Still working on it — check your closet in a minute.");
  await jest.advanceTimersByTimeAsync(5 * 60_000 + 2000);
  await pending;
});

const closetItem = { id: "i1", run_id: "20261018-093000", photo_name: "", item_id: "i1", tier: "high" as const,
                     facts: FACTS, crop_url: "", generated_url: "" };

test("edits, removal, back and 360 use the item's /v1 id", async () => {
  jest.useFakeTimers();
  signIn();
  on("PATCH", "/v1/items/i1", reply(v1Item("i1")));
  on("DELETE", "/v1/items/i1", () => ({ status: 204, body: null }));
  on("POST", "/v1/items/i1/back", reply(job("queued", { kind: "back", item_id: "i1" }), 202));
  on("GET", "/v1/jobs/job-1", reply(job("succeeded", { kind: "back" })));
  on("GET", "/v1/items/i1", reply(v1Item("i1", { back: { generated_url: "https://sb.test/b.png", cutout_url: null, visible_text: "" },
                                                 turn: { state: "running", error: null, views: [] } })));
  on("POST", "/v1/items/i1/turn", reply(job("queued", { kind: "turn" }), 202));

  expect((await updateItem(closetItem, { category: "coat" })).id).toBe("i1");
  await deleteItem(closetItem);
  const backing = addBack(closetItem, "file:///b.jpg");
  await jest.advanceTimersByTimeAsync(2000);
  expect((await backing).back?.generated_url).toBe("https://sb.test/b.png");
  expect(await startTurn(closetItem)).toEqual({ state: "running", error: null, views: [] });
  expect((await getTurn(closetItem)).state).toBe("running");
  expect(calls.every((c) => auth(calls.indexOf(c)) === "Bearer tok-a")).toBe(true);
});

test("a capture sends the fronts the user approved and reports pieces over the limit", async () => {
  signIn();
  const appended: [string, unknown][] = [];
  const RealFormData = global.FormData;
  global.FormData = class { append(name: string, value: unknown) { appended.push([name, value]); } } as unknown as typeof FormData;
  try {
    on("POST", "/v1/jobs", reply(job("succeeded", { item_ids: [], over_limit: 2 }), 202));
    on("GET", "/v1/items", reply({ items: [] }));
    const run = await postRun("file:///p.jpg", 3);
    expect(appended).toContainEqual(["max_fronts", "3"]);
    expect(run.over_limit).toBe(2);
  } finally {
    global.FormData = RealFormData;
  }
});

test("running out of credits reads as a sentence with a way forward", async () => {
  signIn();
  on("POST", "/v1/jobs", reply({ error: "not enough AI credits" }, 402));
  await expect(postRun("file:///p.jpg", 1)).rejects.toThrow(NO_CREDITS);
});

test("credits and prices come from /v1 when signed in, and don't exist in local mode", async () => {
  expect(await getCredits()).toBeNull();
  expect(await getPrices()).toBeNull();
  signIn();
  on("GET", "/v1/credits?before=7", reply({ balance: 1, held: 0, available: 1, granted: 1, used: 0, entries: [], next_before: null }));
  on("GET", "/v1/prices", reply({ billing: true, prices: { garment: 1 } }));
  expect((await getCredits(7))!.available).toBe(1);
  expect((await getPrices())!.prices.garment).toBe(1);
});


// --- Outfit Photo ---
const scanBody = (status: string, extra: object = {}) => ({ id: "scan-1", status, error: null, scene_kind: "worn", person_count: 1,
                                                            candidates: [], expires_at: null, ...extra });

test("an outfit scan uploads the photo and polls until the candidates are ready", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/outfit-scans", reply(scanBody("queued"), 202));
  on("GET", "/v1/outfit-scans/scan-1", reply(scanBody("succeeded", { candidates: [{ id: "c1", category: "blazer" }] })));
  const pending = scanOutfit("file:///p.jpg");
  await jest.advanceTimersByTimeAsync(2000);
  const scan = await pending;
  expect(scan.candidates[0].id).toBe("c1");
  expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  expect(calls[0].init.body).toBeInstanceOf(FormData);
});

test("an expired scan says so", async () => {
  signIn();
  on("GET", "/v1/outfit-scans/scan-1", reply({ error: "this scan has expired" }, 410));
  await expect(getOutfitScan("scan-1")).rejects.toThrow(SCAN_EXPIRED);
});

test("generating sends the picks and the price the user saw, once per key, and returns the pending items", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/outfit-scans/scan-1/generate", () => Promise.reject(new TypeError("Network request failed")),
     reply(job("queued", { kind: "outfit_generate" }), 202));
  on("GET", "/v1/jobs/job-1", reply(job("succeeded", { item_ids: ["i1"], failed: ["c3"] })));
  on("GET", "/v1/items/i1", reply(v1Item("i1", { origin: "outfit_photo", review_state: "pending" })));
  const pending = generateOutfit("scan-1", ["c1", "c3"], 1);
  await jest.advanceTimersByTimeAsync(2000);
  const result = await pending;
  const posts = calls.filter((c) => c.init.method === "POST");
  expect(posts.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"])).toEqual(["key-1", "key-1"]);
  expect(JSON.parse(posts[0].init.body as string)).toEqual({ candidate_ids: ["c1", "c3"], expected_unit_price: 1 });
  expect(result.items[0]).toMatchObject({ item_id: "i1", review_state: "pending" });
  expect(result.failed).toEqual(["c3"]);
});

test("pending results and keep go to /v1; outfit needs an account", async () => {
  await expect(scanOutfit("file:///p.jpg")).rejects.toThrow(OUTFIT_NEEDS_ACCOUNT);
  expect(await getPendingItems()).toEqual([]);
  signIn();
  on("GET", "/v1/items?review=pending", reply({ items: [v1Item("i1", { review_state: "pending" })] }));
  on("POST", "/v1/items/i1/keep", reply(v1Item("i1", { review_state: "kept" })));
  const [item] = await getPendingItems();
  expect((await keepItem(item)).review_state).toBe("kept");
});
