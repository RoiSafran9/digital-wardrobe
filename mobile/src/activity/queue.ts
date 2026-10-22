// The app's activity events wait here and go to POST /v1/events/batch in batches (api/activity.py).
// The queue lives in memory and in AsyncStorage under one account's key, so events survive a restart and
// are only ever sent for the account they belong to. Sending never throws into the app: a failed send keeps
// the events for the next try; beyond MAX_QUEUED the oldest are dropped.

export type EventProps = Record<string, string | number | boolean>;

export type QueuedEvent = {
  event: string;
  props: EventProps;
  client_event_id: string;
  client_at: string;
  session_id: string | null;
};

export type QueueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const MAX_QUEUED = 500;
export const BATCH_SIZE = 50;
export const FLUSH_AT = 20;

export type Queue = {
  add(event: QueuedEvent): void;
  flush(): Promise<void>;
  stop(): Promise<void>;  // one last flush, then nothing more is sent from this queue
  size(): number;
};

export function createQueue(opts: {
  storageKey: string;
  storage: QueueStorage;
  send: (events: QueuedEvent[]) => Promise<void>;
}): Queue {
  let events: QueuedEvent[] = [];
  let stopped = false;
  let sending: Promise<void> | null = null;

  const persist = () => {
    opts.storage.setItem(opts.storageKey, JSON.stringify(events)).catch(() => {});
  };
  const keepLatest = () => {
    if (events.length > MAX_QUEUED) events = events.slice(events.length - MAX_QUEUED);
  };

  // Events from an earlier run of the app (same account) go first.
  const restored = opts.storage.getItem(opts.storageKey).then((raw) => {
    try {
      const saved = raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
      const ids = new Set(events.map((e) => e.client_event_id));
      events = [...saved.filter((e) => e && !ids.has(e.client_event_id)), ...events];
      keepLatest();
    } catch {
      // A corrupt copy is dropped; the next add writes a fresh one.
    }
  }).catch(() => {});

  const drain = async () => {
    await restored;
    while (!stopped && events.length > 0) {
      const batch = events.slice(0, BATCH_SIZE);
      try {
        await opts.send(batch);
      } catch {
        return;  // kept for the next flush (same ids, so a batch the server did store is not stored twice)
      }
      const sent = new Set(batch.map((e) => e.client_event_id));
      events = events.filter((e) => !sent.has(e.client_event_id));
      persist();
    }
  };

  const flush = () => {
    if (!sending) sending = drain().finally(() => { sending = null; });
    return sending;
  };

  return {
    add(event) {
      if (stopped) return;
      events.push(event);
      keepLatest();
      persist();
      if (events.length >= FLUSH_AT) void flush();
    },
    flush,
    async stop() {
      if (stopped) return;
      await flush();
      stopped = true;
    },
    size: () => events.length,
  };
}
