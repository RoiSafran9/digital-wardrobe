-- Activity logging L2: one row per model call (cost, latency, tokens, fallback), and a failure code per job.
-- Written only by the backend worker from its run log (api/worker.py); read by scripts/usage_report.py.
-- No photos, prompts or error messages: the stage, model, numbers and the error's class. When an account or
-- job is deleted the row stays without them (owner decision D1, 2026-10-22), so total AI spend stays right.
-- The worker purges rows after 400 days.
create table public.ai_calls (
  id bigint generated always as identity primary key,
  job_id uuid references public.generation_jobs (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  job_kind text check (length(job_kind) <= 30),
  stage text not null check (length(stage) <= 60),
  model text not null check (length(model) <= 60),
  prompt_version text check (length(prompt_version) <= 60),
  attempt int check (attempt >= 0),
  status text not null check (status in ('ok', 'error')),
  error_class text check (length(error_class) <= 80),
  latency_ms int check (latency_ms >= 0),
  input_tokens int check (input_tokens >= 0),
  output_tokens int check (output_tokens >= 0),
  images_out int check (images_out >= 0),
  fallback boolean not null default false,
  est_cost_usd numeric(10, 5) check (est_cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index ai_calls_created on public.ai_calls (created_at);
create index ai_calls_user_created on public.ai_calls (user_id, created_at);
create index ai_calls_job on public.ai_calls (job_id);

revoke all on public.ai_calls from anon, authenticated;
grant all on public.ai_calls to service_role;
alter table public.ai_calls enable row level security;

-- Why a job failed, as a category (the user-facing message stays in `error`).
alter table public.generation_jobs
  add column failure_code text check (failure_code in ('photo_quality', 'no_garment', 'item_gone', 'scan_expired',
    'model_timeout', 'model_refused', 'model_error', 'all_pieces_failed', 'internal'));
