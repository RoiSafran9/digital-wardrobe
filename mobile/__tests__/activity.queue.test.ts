import { BATCH_SIZE, FLUSH_AT, MAX_QUEUED, createQueue, type QueuedEvent, type QueueStorage } from "../src/activity/queue";

function memoryStorage(initial: Record<string, string> = {}): QueueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => { data[k] = v; },
  };
}

let n = 0;
const ev = (event = "screen_viewed"): QueuedEvent => ({
  event, props: { screen: "closet" }, client_event_id: `id-${++n}`, client_at: new Date().toISOString(), session_id: "s1",
});
const settle = () => new Promise((r) => setTimeout(r, 0));

test("sends a batch once 20 events are waiting", async () => {
  const send = jest.fn(async () => {});
  const q = createQueue({ storageKey: "k", storage: memoryStorage(), send });
  for (let i = 0; i < FLUSH_AT - 1; i++) q.add(ev());
  await settle();
  expect(send).not.toHaveBeenCalled();
  q.add(ev());
  await settle();
  expect(send).toHaveBeenCalledTimes(1);
  expect((send.mock.calls[0] as unknown[])[0]).toHaveLength(FLUSH_AT);
  expect(q.size()).toBe(0);
});

test("sends at most 50 per request", async () => {
  const send = jest.fn(async () => {});
  const q = createQueue({ storageKey: "k", storage: memoryStorage(), send });
  for (let i = 0; i < 120; i++) q.add(ev());
  await q.flush();
  await q.flush();
  const sizes = send.mock.calls.map((c) => ((c as unknown[])[0] as QueuedEvent[]).length);
  expect(Math.max(...sizes)).toBeLessThanOrEqual(BATCH_SIZE);
  expect(sizes.reduce((a, b) => a + b, 0)).toBe(120);
});

test("keeps events when sending fails and resends them with the same ids", async () => {
  const send = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const q = createQueue({ storageKey: "k", storage: memoryStorage(), send });
  const a = ev();
  q.add(a);
  await q.flush();
  expect(q.size()).toBe(1);
  await q.flush();
  expect(q.size()).toBe(0);
  const ids = send.mock.calls.map((c) => ((c[0] as QueuedEvent[])[0]).client_event_id);
  expect(ids).toEqual([a.client_event_id, a.client_event_id]);
});

test("restores unsent events after a restart", async () => {
  const storage = memoryStorage();
  const first = createQueue({ storageKey: "activity.queue.A", storage, send: async () => { throw new Error("offline"); } });
  const saved = ev();
  first.add(saved);
  await first.flush();
  const send = jest.fn(async () => {});
  const second = createQueue({ storageKey: "activity.queue.A", storage, send });
  await second.flush();
  expect((send.mock.calls[0] as unknown[])[0]).toEqual([saved]);
});

test("keeps at most 500, dropping the oldest", async () => {
  const q = createQueue({ storageKey: "k", storage: memoryStorage(), send: async () => { throw new Error("offline"); } });
  const all: QueuedEvent[] = [];
  for (let i = 0; i < MAX_QUEUED + 10; i++) { const e = ev(); all.push(e); q.add(e); }
  await settle();
  expect(q.size()).toBe(MAX_QUEUED);
});

test("a stopped queue sends nothing more; another account never sends its events", async () => {
  const storage = memoryStorage();
  const sendA = jest.fn(async () => { throw new Error("signed out"); });
  const a = createQueue({ storageKey: "activity.queue.A", storage, send: sendA });
  const fromA = ev();
  a.add(fromA);
  await a.stop();
  a.add(ev());
  expect(sendA).toHaveBeenCalledTimes(1);
  const sendB = jest.fn(async () => {});
  const b = createQueue({ storageKey: "activity.queue.B", storage, send: sendB });
  b.add(ev());
  await b.flush();
  const sentByB = sendB.mock.calls.flatMap((c) => (c as unknown[])[0] as QueuedEvent[]);
  expect(sentByB.map((e) => e.client_event_id)).not.toContain(fromA.client_event_id);
  expect(JSON.parse(storage.data["activity.queue.A"])).toHaveLength(1);  // waits for A's next sign-in
});

test("a corrupt saved copy is ignored", async () => {
  const send = jest.fn(async () => {});
  const q = createQueue({ storageKey: "k", storage: memoryStorage({ k: "{not json" }), send });
  q.add(ev());
  await q.flush();
  expect(send).toHaveBeenCalledTimes(1);
});
