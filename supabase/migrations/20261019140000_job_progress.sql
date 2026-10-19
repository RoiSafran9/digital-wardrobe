-- Redesign M8: how far a garment job has got (pieces finished / pieces being made), so the app can
-- show "2 of 3". Written only by the backend worker; users can read it on their own jobs through the
-- existing select policy. No model calls depend on it.
alter table public.generation_jobs
  add column progress jsonb
  check (progress is null or (jsonb_typeof(progress -> 'done') = 'number' and jsonb_typeof(progress -> 'total') = 'number'));
