-- Activity logging L5: read-only views for the owner, in a schema the app's API keys can't reach
-- (Postgres views run with their owner's rights, so they must not sit in `public`). Open them in the
-- Supabase SQL editor; scripts/usage_report.py computes the same numbers from the tables.
-- No photos, file paths, facts, emails or names: ids, kinds, numbers and times only.
create schema if not exists reports;
revoke all on schema reports from public, anon, authenticated;
grant usage on schema reports to service_role;

-- One account's history in time order (filter by user_id).
create or replace view reports.timeline as
  select user_id, created_at as at, source, event as what,
         props || jsonb_strip_nulls(jsonb_build_object('job_id', job_id, 'item_id', item_id, 'session_id', session_id,
                                                       'app_version', app_version)) as detail
    from public.activity_events
  union all
  select user_id, created_at, 'server', 'job_started:' || kind,
         jsonb_strip_nulls(jsonb_build_object('job_id', id, 'cost_credits', cost_credits, 'max_items', max_items))
    from public.generation_jobs
  union all
  select user_id, finished_at, 'server', 'job_' || status || ':' || kind,
         jsonb_strip_nulls(jsonb_build_object('job_id', id, 'failure_code', failure_code, 'attempts', attempts,
                                              'seconds', round(extract(epoch from finished_at - created_at))))
    from public.generation_jobs where finished_at is not null
  union all
  select user_id, created_at, 'server', 'credits_' || kind,
         jsonb_strip_nulls(jsonb_build_object('amount', amount, 'action', action, 'job_id', job_id, 'balance_after', balance_after))
    from public.credit_ledger
  union all
  select user_id, created_at, 'server', 'item_created',
         jsonb_strip_nulls(jsonb_build_object('item_id', id, 'origin', origin, 'job_id', job_id))
    from public.wardrobe_items
  union all
  select user_id, deleted_at, 'server', 'item_removed', jsonb_build_object('item_id', id)
    from public.wardrobe_items where deleted_at is not null;

-- Jobs per UTC day and kind: how many, how many worked, and how long they took (queued → finished).
create or replace view reports.job_outcomes as
  select date_trunc('day', created_at)::date as day, kind,
         count(*) as jobs,
         count(*) filter (where status = 'succeeded') as succeeded,
         count(*) filter (where status = 'failed') as failed,
         percentile_cont(0.5) within group (order by extract(epoch from finished_at - created_at))
           filter (where finished_at is not null) as p50_seconds,
         percentile_cont(0.95) within group (order by extract(epoch from finished_at - created_at))
           filter (where finished_at is not null) as p95_seconds
    from public.generation_jobs group by 1, 2;

-- Estimated AI cost per UTC day, job kind and model (pipeline/costs.py rates).
create or replace view reports.ai_cost_daily as
  select date_trunc('day', created_at)::date as day, job_kind, model,
         count(*) as calls, count(*) filter (where fallback) as fallback_calls,
         count(*) filter (where status = 'error') as failed_calls,
         coalesce(sum(est_cost_usd), 0) as est_cost_usd
    from public.ai_calls group by 1, 2, 3;

-- Accounts that did anything on a UTC day (an event, a job or a credit hold/charge).
create or replace view reports.daily_active as
  select day, count(distinct user_id) as accounts from (
    select date_trunc('day', created_at)::date as day, user_id from public.activity_events
    union all select date_trunc('day', created_at)::date, user_id from public.generation_jobs
    union all select date_trunc('day', created_at)::date, user_id from public.credit_ledger where kind in ('hold', 'charge')
  ) a group by day;

revoke all on all tables in schema reports from public, anon, authenticated;
grant select on all tables in schema reports to service_role;
