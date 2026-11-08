import { API_BASE_URL, BUILD_MY_LOOK_NEEDS_ACCOUNT, DELETE_NEEDS_ACCOUNT, PICKING_NEEDS_ACCOUNT, pollJob, postEvent, scanGarments, startGarmentGenerate, getProfile, setDisplayName, getOutfitSuggestions, getSwapOptions, OUTFIT_NEEDS_ACCOUNT, addBack, configureApi, deleteAccount, deleteItem, startOutfitGenerate, startGarmentJob, reconnectGarmentJob, getCredits, getItems, getOutfitScan, getPendingItems, getPrices, getTurn, imageUrl, keepItem, postRun, scanOutfit, startTurn, updateItem } from "../src/api/client";
import { ApiError, JOB_GONE, NO_CREDITS, SCAN_EXPIRED, SIGNED_OUT, operationOf } from "../src/api/v1";
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
  // One action, one request id in the server log: the resend keeps it; the poll after it gets its own.
  const ids = calls.map((c) => (c.init.headers as Record<string, string>)["X-Request-ID"]);
  expect(ids[0]).toMatch(/^[0-9a-f]{32}$/);
  expect(ids[1]).toBe(ids[0]);
  expect(ids[2]).toMatch(/^[0-9a-f]{32}$/);
  expect(ids[2]).not.toBe(ids[0]);
});

test("every signed-in call carries a fresh request id; failures keep it with the operation and status", async () => {
  signIn();
  const itemId = "11111111-2222-4333-8444-555555555555";
  on("GET", "/v1/items", reply({ items: [] }));
  on("PATCH", `/v1/items/${itemId}`, reply({ error: "that piece is gone" }, 404));
  await getItems();
  const error = await updateItem({ ...v1Item(itemId), item_id: itemId, photo_name: "", run_id: "r" } as never, { name: "x" })
    .catch((e) => e);
  const [first, second] = calls.map((c) => (c.init.headers as Record<string, string>)["X-Request-ID"]);
  expect(first).toMatch(/^[0-9a-f]{32}$/);
  expect(second).not.toBe(first);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ message: "That piece is gone", status: 404, requestId: second,
                                operation: "PATCH /v1/items/{id}" });
  expect(JSON.stringify({ ...error, message: error.message })).not.toContain("tok-a");
});

test("the request id the server sends back is the one kept with an error", async () => {
  signIn();
  const echoed = "cd".repeat(16);
  global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}),
                                        headers: { get: (h: string) => (h === "X-Request-ID" ? echoed : null) } })) as never;
  const error = await getItems().catch((e) => e);
  expect(error).toMatchObject({ requestId: echoed, status: 500, operation: "GET /v1/items" });
});

test("operations drop ids and queries", () => {
  expect(operationOf("post", "/v1/jobs")).toBe("POST /v1/jobs");
  expect(operationOf(undefined, "/v1/credits?before=12")).toBe("GET /v1/credits");
  expect(operationOf("GET", "/v1/jobs/0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e")).toBe("GET /v1/jobs/{id}");
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

test("generating sends the picks and the price the user saw under the caller's key, again with it when there was no answer", async () => {
  signIn();
  on("POST", "/v1/outfit-scans/scan-1/generate", () => Promise.reject(new TypeError("Network request failed")),
     reply(job("queued", { kind: "outfit_generate" }), 202));
  const started = await startOutfitGenerate("scan-1", ["c1", "c3"], 1, { c1: "coat" }, "og:k1");
  expect(started).toMatchObject({ id: "job-1", status: "queued" });
  const posts = calls.filter((c) => c.init.method === "POST");
  expect(posts.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"])).toEqual(["og:k1", "og:k1"]);
  expect(JSON.parse(posts[0].init.body as string)).toEqual({ candidate_ids: ["c1", "c3"], expected_unit_price: 1, corrections: { c1: "coat" } });
  expect(calls.some((c) => c.url.includes("/v1/jobs/"))).toBe(false);  // starting never waits for the images
});

test("a garment photo starts under the caller's key; reconnecting sends only the key, no photo", async () => {
  signIn();
  on("POST", "/v1/jobs", reply(job("queued"), 202), reply(job("running"), 200));
  await startGarmentJob("file:///p.jpg", 2, "cap:k1");
  await reconnectGarmentJob("cap:k1");
  expect(calls.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"])).toEqual(["cap:k1", "cap:k1"]);
  expect(calls[0].init.body).toBeInstanceOf(FormData);
  expect(calls[1].init.body).toBeUndefined();
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

test("a capture reports the server's per-piece progress while it polls", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/jobs", reply(job("queued"), 202));
  on("GET", "/v1/jobs/job-1", reply(job("running", { progress: { done: 1, total: 3 } })),
     reply(job("succeeded", { item_ids: [], quality: { status: "ok", reason: null }, failed: [], progress: { done: 3, total: 3 } })));
  on("GET", "/v1/items", reply({ items: [] }));
  const seen: unknown[] = [];
  const pending = postRun("file:///p.jpg", undefined, (p) => seen.push(p));
  await jest.advanceTimersByTimeAsync(4000);
  await pending;
  expect(seen[0]).toEqual({ done: 1, total: 3 });
});

test("deleting the account sends the confirmation to /v1/account; local mode has none", async () => {
  await expect(deleteAccount()).rejects.toThrow(DELETE_NEEDS_ACCOUNT);
  signIn();
  on("DELETE", "/v1/account", reply(null, 204));
  await deleteAccount();
  expect(JSON.parse(calls[0].init.body as string)).toEqual({ confirm: "DELETE" });
  expect(auth(0)).toBe("Bearer tok-a");
});

test("the profile and its name come from /v1/profile; local mode has none", async () => {
  expect(await getProfile()).toBeNull();
  signIn();
  on("GET", "/v1/profile", reply({ email: "a@x.com", display_name: null }));
  on("PATCH", "/v1/profile", reply({ email: "a@x.com", display_name: "Maya" }));
  expect((await getProfile())?.display_name).toBeNull();
  expect((await setDisplayName("Maya")).display_name).toBe("Maya");
  expect(JSON.parse(calls[1].init.body as string)).toEqual({ display_name: "Maya" });
});

// First 3 Pieces: several generate jobs, each under a key the app keeps so a restart never makes a second one.
test("a generate job is started under the caller's key and sent again with it when there was no answer", async () => {
  signIn();
  on("POST", "/v1/garment-scans/scan-1/generate",
     () => Promise.reject(new TypeError("Network request failed")), reply(job("queued"), 200));
  const started = await startGarmentGenerate("scan-1", [0, 2], 1, "fp:r1:scan-1");
  expect(started.id).toBe("job-1");
  const posts = calls.filter((c) => c.init.method === "POST");
  expect(posts.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"])).toEqual(["fp:r1:scan-1", "fp:r1:scan-1"]);
  expect(JSON.parse(posts[0].init.body as string)).toEqual({ piece_indexes: [0, 2], expected_unit_price: 1 });
});

test("a job started earlier is polled by id with progress until it finishes", async () => {
  jest.useFakeTimers();
  signIn();
  on("GET", "/v1/jobs/job-1", reply(job("running", { progress: { done: 1, total: 2 } })),
     reply(job("succeeded", { item_ids: ["i1", "i2"], progress: { done: 2, total: 2 } })));
  const seen: { done: number; total: number }[] = [];
  const statuses: string[] = [];
  const pending = pollJob("job-1", { onProgress: (p) => seen.push(p), onJob: (j) => statuses.push(j.status) });
  await jest.advanceTimersByTimeAsync(2000);
  const done = await pending;
  expect(done.item_ids).toEqual(["i1", "i2"]);
  expect(seen).toEqual([{ done: 1, total: 2 }, { done: 2, total: 2 }]);
  expect(statuses).toEqual(["running", "succeeded"]);
});

test("following a job has no five-minute limit: a slow job is still followed, never called failed", async () => {
  jest.useFakeTimers();
  signIn();
  const long = Array.from({ length: 200 }, () => reply(job("running", { progress: { done: 0, total: 2 } })));
  on("GET", "/v1/jobs/job-1", ...long, reply(job("succeeded", { item_ids: ["i1"] })));
  routes["GET /v1/jobs/job-1"].push(reply(job("succeeded", { item_ids: ["i1"] })));
  let outcome: string | null = null;
  pollJob("job-1").then(() => { outcome = "succeeded"; }, (e) => { outcome = `threw ${e.message}`; });
  await jest.advanceTimersByTimeAsync(6 * 60_000);
  expect(outcome).toBeNull();  // past the old limit: still following
  await jest.advanceTimersByTimeAsync(30 * 60_000);
  expect(outcome).toBe("succeeded");
  expect(calls.every((c) => (c.init.method ?? "GET") === "GET")).toBe(true);  // never started anything again
});

test("a lost connection or a Cloudflare error while following is waited out, not reported as a failure", async () => {
  jest.useFakeTimers();
  signIn();
  on("GET", "/v1/jobs/job-1", reply(job("running")), () => Promise.reject(new TypeError("Network request failed")),
     reply({ error: "origin unreachable" }, 530), reply(job("running", { progress: { done: 1, total: 1, made: 1 } })),
     reply(job("succeeded", { item_ids: ["i1"] })));
  const offline: boolean[] = [];
  const pending = pollJob("job-1", { onOffline: (o) => offline.push(o) });
  await jest.advanceTimersByTimeAsync(60_000);
  expect((await pending).item_ids).toEqual(["i1"]);
  expect(offline).toEqual([true, false]);
});

test("Cloudflare's HTML page and a crash's plain text while following are waited out, never a failure", async () => {
  jest.useFakeTimers();
  signIn();
  const html = (status: number): Route => () => ({ status, body: undefined });  // json() below throws for these
  on("GET", "/v1/jobs/job-1", html(530), html(500), html(524), reply(job("succeeded", { item_ids: ["i1"] })));
  const realFetch = global.fetch as jest.Mock;
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const r = await realFetch(url, init);
    return r.status >= 500 ? { ...r, ok: false, json: async () => { throw new SyntaxError("Unexpected token <"); } } : r;
  }) as jest.Mock;
  const offline: boolean[] = [];
  const pending = pollJob("job-1", { onOffline: (o) => offline.push(o) });
  await jest.advanceTimersByTimeAsync(60_000);
  expect((await pending).item_ids).toEqual(["i1"]);
  expect(offline).toEqual([true, false]);
});

test("a server's own error is answered=true; an unreadable answer is not", async () => {
  signIn();
  on("POST", "/v1/outfit-scans/scan-1/generate", reply({ error: "AI generation is paused for now — your closet still works. Try again later" }, 503));
  const paused = await startOutfitGenerate("scan-1", ["c1"], null, {}, "og:k").catch((e) => e);
  expect(paused).toMatchObject({ status: 503, answered: true });
  const realFetch = global.fetch as jest.Mock;
  global.fetch = jest.fn(async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError("<html>"); } })) as jest.Mock;
  const cloudflare = await startOutfitGenerate("scan-1", ["c1"], null, {}, "og:k").catch((e) => e);
  expect(cloudflare).toMatchObject({ status: 502, answered: false });
  global.fetch = realFetch;
});

test("following stops with JOB_GONE for a job the server doesn't know, and SIGNED_OUT when the account changes", async () => {
  jest.useFakeTimers();
  signIn();
  on("GET", "/v1/jobs/job-1", reply({ error: "not found" }, 404));
  await expect(pollJob("job-1")).rejects.toThrow(JOB_GONE);
  on("GET", "/v1/jobs/job-2", reply({ ...job("running"), id: "job-2" }));
  const pending = pollJob("job-2");
  const settled = expect(pending).rejects.toThrow(SIGNED_OUT);
  signIn("tok-b");  // another account now: the old account's job is never asked for with the new token
  await jest.advanceTimersByTimeAsync(2000);
  await settled;
  expect(calls.filter((c) => c.url.endsWith("/v1/jobs/job-2")).map((_, i) => auth(calls.findIndex((c) => c.url.endsWith("/v1/jobs/job-2")) + i)))
    .toEqual(["Bearer tok-a"]);
});

test("polling a failed job throws its sentence", async () => {
  signIn();
  on("GET", "/v1/jobs/job-1", reply(job("failed", { error: "this photo's scan has expired — take the photo again" })));
  await expect(pollJob("job-1")).rejects.toThrow("This photo's scan has expired — take the photo again");
});

test("a pre-scan can use the caller's key; starting and polling need an account", async () => {
  jest.useFakeTimers();
  signIn();
  on("POST", "/v1/garment-scans", reply({ id: "scan-1", status: "succeeded", pieces: [] }, 202));
  await scanGarments("file:///p.jpg", "fp-scan-1");
  expect((calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe("fp-scan-1");
  configureApi(null);
  await expect(startGarmentGenerate("scan-1", [0], null, "k")).rejects.toThrow(PICKING_NEEDS_ACCOUNT);
  await expect(pollJob("job-1")).rejects.toThrow(PICKING_NEEDS_ACCOUNT);
});

// --- Build My Look ---
const ANY_FILTERS = { occasion: "any" as const, style: "any" as const, vibe: "any" as const, weather: "any" as const, colors: "any" as const };

test("suggestions and swap options need a signed-in account", async () => {
  await expect(getOutfitSuggestions(ANY_FILTERS)).rejects.toThrow(BUILD_MY_LOOK_NEEDS_ACCOUNT);
  await expect(getSwapOptions({ slots: {}, item_ids: [] }, "i1", ANY_FILTERS)).rejects.toThrow(BUILD_MY_LOOK_NEEDS_ACCOUNT);
});

test("suggestions are posted with the chosen filters and come back with the server's looks", async () => {
  signIn();
  on("POST", "/v1/outfit-suggestions", reply({
    looks: [{ look_id: "look_1", title: "Easy Workday", reason: "A clean pairing.", item_ids: ["g1", "g2"],
             slots: { top: "g1", bottom: "g2" }, completeness: "core_outfit" }],
    applied_filters: ANY_FILTERS, limitations: [], used_fallback: false,
  }));
  const result = await getOutfitSuggestions({ ...ANY_FILTERS, occasion: "work" });
  expect(JSON.parse(calls[0].init.body as string)).toEqual({ ...ANY_FILTERS, occasion: "work" });
  expect(auth(0)).toBe("Bearer tok-a");
  expect(result.looks[0].title).toBe("Easy Workday");
  await getOutfitSuggestions(ANY_FILTERS, [["g1", "g2"]]);  // Generate Again: the looks on screen
  expect(JSON.parse(calls[1].init.body as string)).toEqual({ ...ANY_FILTERS, shown: [["g1", "g2"]] });
});

test("swap options are posted with the look, target and filters, and come back ranked", async () => {
  signIn();
  on("POST", "/v1/outfit-suggestions/swap-options", reply({
    target_slot: "bottom", alternatives: [{ item_id: "g7", reason: "A similarly polished option." }],
  }));
  const result = await getSwapOptions({ slots: { top: "g1", bottom: "g2" }, item_ids: ["g1", "g2"] }, "g2", ANY_FILTERS);
  expect(JSON.parse(calls[0].init.body as string)).toEqual({
    look: { slots: { top: "g1", bottom: "g2" }, item_ids: ["g1", "g2"] }, target_item_id: "g2", filters: ANY_FILTERS,
  });
  expect(result.target_slot).toBe("bottom");
  expect(result.alternatives[0].item_id).toBe("g7");
});

test("a stale look answers a conflict the caller's sentence reads plainly", async () => {
  signIn();
  on("POST", "/v1/outfit-suggestions/swap-options", reply({ error: "this look is out of date — refresh and try again" }, 409));
  await expect(getSwapOptions({ slots: {}, item_ids: [] }, "gone", ANY_FILTERS))
    .rejects.toThrow("This look is out of date — refresh and try again");
});

test("activation steps go to /v1/events when signed in; local mode sends nothing", async () => {
  await postEvent("popup_shown", { saved: 2 });
  expect(calls).toHaveLength(0);
  signIn();
  on("POST", "/v1/events", reply(undefined, 204));
  await postEvent("popup_shown", { saved: 2 });
  expect(JSON.parse(calls[0].init.body as string)).toEqual({ event: "popup_shown", props: { saved: 2 } });
});
