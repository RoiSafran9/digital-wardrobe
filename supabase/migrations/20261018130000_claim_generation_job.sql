-- Multi-user M3: the backend worker's queue. Postgres is the queue; no Redis.
-- Claims the oldest queued job, or a running job whose lease ran out (its worker died), and leases it.
-- A dead job already on its last attempt is marked failed instead of being retried forever.
create function public.claim_generation_job(lease_seconds int default 600)
returns setof public.generation_jobs
language plpgsql
set search_path = ''
as $$
begin
  update public.generation_jobs
     set status = 'failed', error = 'Interrupted — try again', finished_at = now(), locked_until = null
   where status = 'running' and locked_until < now() and attempts >= max_attempts;

  return query
  update public.generation_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_until = now() + make_interval(secs => lease_seconds),
         started_at = coalesce(j.started_at, now())
   where j.id = (
     select id from public.generation_jobs
      where status = 'queued' or (status = 'running' and locked_until < now())
      order by created_at
      limit 1
      for update skip locked)
  returning j.*;
end;
$$;

revoke execute on function public.claim_generation_job(int) from public, anon, authenticated;
grant execute on function public.claim_generation_job(int) to service_role;
