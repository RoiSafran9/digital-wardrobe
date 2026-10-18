-- AI Credits M2: what per-action billing needs from the database. Billing is still off unless the
-- server is started with WARDROBE_BILLING=on.
--
-- Owner decision (2026-10-18): a photo can hold several garments; before capturing, the user
-- approves how many front images they will pay for (default 1). The job holds price × that number,
-- makes at most that many fronts, and is charged only for the fronts it made; the rest goes back.
--
-- 1. generation_jobs.max_items: the fronts the user approved (garment jobs, billing on only).
-- 2. credit_settle(job, amount): charge part of a hold and release the rest (charge + release rows).
-- 3. credit_reconcile(grace): ends holds the worker never ended — failed/canceled jobs (including
--    ones the queue expired), finished jobs whose worker died before settling, and holds whose job
--    was never created. Same counting as the worker, so the result is the same whoever gets there first.

alter table public.generation_jobs
  add column max_items int check (max_items between 1 and 20),
  add check (max_items is null or kind = 'garment');

-- A hold may now end in a charge, a release, or both (a partial charge); each at most once.
drop index public.credit_ledger_one_end;
create unique index credit_ledger_one_charge on public.credit_ledger (job_id) where kind = 'charge';
create unique index credit_ledger_one_release on public.credit_ledger (job_id) where kind = 'release';

drop function public.credit_settle(uuid);
drop function public.credit_release(uuid);
drop function public.credit_end_hold(uuid, text);

-- Ends a job's hold: charge p_charge credits (null = all of it) and release the rest.
-- Repeating with the same charge returns the same rows; a different charge is WC409.
create function public.credit_end_hold(p_job_id uuid, p_charge int)
returns setof public.credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hold public.credit_ledger;
  w public.credit_wallets;
  r public.credit_ledger;
  ended int;
  charged int;
begin
  if p_job_id is null then
    raise exception 'a job id is required' using errcode = 'WC422';
  end if;
  select * into hold from public.credit_ledger where job_id = p_job_id and kind = 'hold';
  if not found then
    return;  -- nothing was held (billing off, or a free action)
  end if;
  p_charge := coalesce(p_charge, hold.amount);
  if p_charge < 0 or p_charge > hold.amount then
    raise exception 'a charge must be between 0 and the % credits held', hold.amount using errcode = 'WC422';
  end if;
  w := public.credit_lock_wallet(hold.user_id);

  select count(*), coalesce(sum(amount) filter (where kind = 'charge'), 0) into ended, charged
    from public.credit_ledger where job_id = p_job_id and kind in ('charge', 'release');
  if ended > 0 then
    if charged = p_charge then
      return query select * from public.credit_ledger where job_id = p_job_id and kind in ('charge', 'release') order by id;
      return;
    end if;
    raise exception 'job % was already settled for % credits', p_job_id, charged using errcode = 'WC409';
  end if;

  if p_charge > 0 then
    update public.credit_wallets set balance = balance - p_charge, held = held - p_charge, updated_at = now()
     where user_id = hold.user_id returning * into w;
    insert into public.credit_ledger (user_id, kind, amount, balance_after, held_after, action, job_id, operation_key)
    values (hold.user_id, 'charge', p_charge, w.balance, w.held, hold.action, p_job_id, 'job:' || p_job_id || ':charge')
    returning * into r;
    return next r;
  end if;
  if hold.amount > p_charge then
    update public.credit_wallets set held = held - (hold.amount - p_charge), updated_at = now()
     where user_id = hold.user_id returning * into w;
    insert into public.credit_ledger (user_id, kind, amount, balance_after, held_after, action, job_id, operation_key)
    values (hold.user_id, 'release', hold.amount - p_charge, w.balance, w.held, hold.action, p_job_id,
            'job:' || p_job_id || ':release')
    returning * into r;
    return next r;
  end if;
end;
$$;

create function public.credit_settle(p_job_id uuid, p_amount int default null)
returns setof public.credit_ledger
language sql
security definer
set search_path = ''
as $$ select * from public.credit_end_hold(p_job_id, p_amount) $$;

create function public.credit_release(p_job_id uuid)
returns setof public.credit_ledger
language sql
security definer
set search_path = ''
as $$ select * from public.credit_end_hold(p_job_id, 0) $$;

-- What a finished job is charged: its price per action × the actions it delivered
-- (fronts made, capped at the fronts approved; one for a back or 360), never more than the hold.
create function public.credit_job_charge(j public.generation_jobs, held int)
returns int
language sql
immutable
set search_path = ''
as $$
  select least(held, coalesce(j.cost_credits, 0) * least(
           coalesce(jsonb_array_length(case when jsonb_typeof(j.result -> 'item_ids') = 'array' then j.result -> 'item_ids' end), 0),
           coalesce(j.max_items, 1)))
$$;

create function public.credit_reconcile(p_grace_seconds int default 900)
returns setof public.credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hold public.credit_ledger;
  j public.generation_jobs;
begin
  for hold in
    select h.* from public.credit_ledger h
     where h.kind = 'hold'
       and not exists (select 1 from public.credit_ledger e where e.job_id = h.job_id and e.kind in ('charge', 'release'))
     order by h.id
  loop
    select * into j from public.generation_jobs where id = hold.job_id;
    begin
      if not found then
        -- The request that took the hold died before creating its job (or the job is gone).
        if hold.created_at <= now() - make_interval(secs => greatest(p_grace_seconds, 0)) then
          return query select * from public.credit_end_hold(hold.job_id, 0);
        end if;
      elsif j.status in ('failed', 'canceled') then
        return query select * from public.credit_end_hold(hold.job_id, 0);
      elsif j.status = 'succeeded' then
        return query select * from public.credit_end_hold(hold.job_id, public.credit_job_charge(j, hold.amount));
      end if;  -- queued or running: the worker (or the queue's expiry) will finish it
    exception when sqlstate 'WC409' then
      null;  -- the worker ended it differently in the meantime; the ledger already has the answer
    end;
  end loop;
end;
$$;

revoke execute on function public.credit_end_hold(uuid, int), public.credit_settle(uuid, int), public.credit_release(uuid),
  public.credit_job_charge(public.generation_jobs, int), public.credit_reconcile(int)
  from public, anon, authenticated, service_role;
grant execute on function public.credit_settle(uuid, int), public.credit_release(uuid), public.credit_reconcile(int)
  to service_role;
