-- AI Credits M1: one wallet per account and an append-only ledger. Billing stays off: nothing calls
-- reserve/settle/release yet, and only an admin grant (scripts/grant_credits.py) adds credits.
--
-- credit_wallets is a cache of the ledger (available = balance - held). Nobody, not even the backend's
-- service_role, may write either table directly: the only writers are the four security definer
-- functions below, which lock the wallet row, append one ledger row and update the wallet in the same
-- transaction. Every operation has a stable key, so a retried call returns the first result.
--
-- Errors (SQLSTATE): WC402 not enough credits · WC403 disabled account · WC404 unknown user ·
-- WC405 ledger is append-only · WC409 the job's hold already ended the other way · WC422 invalid input
-- or a key reused for a different operation.

create table public.credit_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  held int not null default 0 check (held >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (held <= balance)
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- grant: balance + amount · hold: held + amount · charge: balance and held - amount · release: held - amount
  kind text not null check (kind in ('grant', 'hold', 'charge', 'release')),
  amount int not null check (amount > 0),
  balance_after int not null check (balance_after >= 0),
  held_after int not null check (held_after >= 0),
  action text check (action in ('garment', 'back', 'turn')),
  job_id uuid,  -- no foreign key: the hold is taken before the job row exists
  operation_key text not null check (length(operation_key) between 1 and 300),
  note text check (length(note) between 1 and 500),             -- the grant's reason; the user sees it
  granted_by text check (length(granted_by) between 1 and 100), -- the admin; hidden from the app
  created_at timestamptz not null default now(),
  unique (user_id, operation_key),
  check ((kind = 'grant') = (job_id is null)),
  check ((kind = 'grant') = (action is null)),
  check ((kind = 'grant') = (note is not null and granted_by is not null))
);

-- One hold per job, and it ends at most once (charged or released, never both).
create unique index credit_ledger_one_hold on public.credit_ledger (job_id) where kind = 'hold';
create unique index credit_ledger_one_end on public.credit_ledger (job_id) where kind in ('charge', 'release');
create index credit_ledger_user_recent on public.credit_ledger (user_id, id desc);

create function public.credit_ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Deleting the account cascades here after auth.users lost the row; that is the only way out.
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;
  raise exception 'credit ledger rows cannot be changed or deleted' using errcode = 'WC405';
end;
$$;

create trigger credit_ledger_append_only
  before update or delete on public.credit_ledger
  for each row execute function public.credit_ledger_append_only();

-- Every account gets an empty wallet: at sign-up from now on, and existing accounts here.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.credit_wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

insert into public.credit_wallets (user_id) select id from auth.users on conflict do nothing;

-- Operations ----------------------------------------------------------------------------------------

-- Locks the user's wallet (creating it if a gap ever left none). Internal: not executable by any client role.
create function public.credit_lock_wallet(p_user_id uuid)
returns public.credit_wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.credit_wallets;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'unknown user' using errcode = 'WC404';
  end if;
  insert into public.credit_wallets (user_id) values (p_user_id) on conflict do nothing;
  select * into w from public.credit_wallets where user_id = p_user_id for update;
  return w;
end;
$$;

create function public.credit_refuse_disabled(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = p_user_id and status = 'disabled') then
    raise exception 'this account is disabled' using errcode = 'WC403';
  end if;
end;
$$;

create function public.credit_grant(p_user_id uuid, p_amount int, p_operation_key text, p_note text, p_granted_by text)
returns setof public.credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.credit_wallets;
  r public.credit_ledger;
  k text := 'grant:' || p_operation_key;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'a grant must be a positive whole number of credits' using errcode = 'WC422';
  end if;
  if coalesce(btrim(p_operation_key), '') = '' or coalesce(btrim(p_note), '') = '' or coalesce(btrim(p_granted_by), '') = '' then
    raise exception 'a grant needs an operation key, a reason and the admin who gave it' using errcode = 'WC422';
  end if;
  w := public.credit_lock_wallet(p_user_id);

  select * into r from public.credit_ledger where user_id = p_user_id and operation_key = k;
  if found then
    if r.amount = p_amount then
      return next r;  -- a repeated grant: already done
      return;
    end if;
    raise exception 'operation key % was already used for a different grant', p_operation_key using errcode = 'WC422';
  end if;
  perform public.credit_refuse_disabled(p_user_id);

  update public.credit_wallets set balance = balance + p_amount, updated_at = now()
   where user_id = p_user_id returning * into w;
  insert into public.credit_ledger (user_id, kind, amount, balance_after, held_after, operation_key, note, granted_by)
  values (p_user_id, 'grant', p_amount, w.balance, w.held, k, btrim(p_note), btrim(p_granted_by))
  returning * into r;
  return next r;
end;
$$;

create function public.credit_reserve(p_user_id uuid, p_job_id uuid, p_action text, p_amount int)
returns setof public.credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.credit_wallets;
  r public.credit_ledger;
begin
  if p_job_id is null or p_amount is null or p_amount <= 0 or p_action is null or p_action not in ('garment', 'back', 'turn') then
    raise exception 'a reserve needs a job, a known action and a positive cost' using errcode = 'WC422';
  end if;
  w := public.credit_lock_wallet(p_user_id);

  select * into r from public.credit_ledger where job_id = p_job_id and kind = 'hold';
  if found then
    if r.user_id = p_user_id and r.action = p_action and r.amount = p_amount then
      return next r;  -- a repeated reserve: already held
      return;
    end if;
    raise exception 'job % already holds credits for a different operation', p_job_id using errcode = 'WC422';
  end if;
  perform public.credit_refuse_disabled(p_user_id);
  if w.balance - w.held < p_amount then
    raise exception 'not enough AI credits' using errcode = 'WC402';
  end if;

  update public.credit_wallets set held = held + p_amount, updated_at = now()
   where user_id = p_user_id returning * into w;
  insert into public.credit_ledger (user_id, kind, amount, balance_after, held_after, action, job_id, operation_key)
  values (p_user_id, 'hold', p_amount, w.balance, w.held, p_action, p_job_id, 'job:' || p_job_id || ':hold')
  returning * into r;
  return next r;
end;
$$;

-- Ends a job's hold: 'charge' (it succeeded) or 'release' (it failed for good / was never created).
-- A job with no hold (billing off) returns no row. Internal: called by credit_settle / credit_release.
create function public.credit_end_hold(p_job_id uuid, p_kind text)
returns setof public.credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hold public.credit_ledger;
  w public.credit_wallets;
  r public.credit_ledger;
begin
  if p_job_id is null then
    raise exception 'a job id is required' using errcode = 'WC422';
  end if;
  select * into hold from public.credit_ledger where job_id = p_job_id and kind = 'hold';
  if not found then
    return;
  end if;
  w := public.credit_lock_wallet(hold.user_id);

  select * into r from public.credit_ledger where job_id = p_job_id and kind in ('charge', 'release');
  if found then
    if r.kind = p_kind then
      return next r;  -- repeated: already done
      return;
    end if;
    raise exception 'job % was already %', p_job_id, case r.kind when 'charge' then 'charged' else 'released' end
      using errcode = 'WC409';
  end if;

  update public.credit_wallets
     set balance = balance - case when p_kind = 'charge' then hold.amount else 0 end,
         held = held - hold.amount, updated_at = now()
   where user_id = hold.user_id returning * into w;
  insert into public.credit_ledger (user_id, kind, amount, balance_after, held_after, action, job_id, operation_key)
  values (hold.user_id, p_kind, hold.amount, w.balance, w.held, hold.action, p_job_id, 'job:' || p_job_id || ':' || p_kind)
  returning * into r;
  return next r;
end;
$$;

create function public.credit_settle(p_job_id uuid)
returns setof public.credit_ledger
language sql
security definer
set search_path = ''
as $$ select * from public.credit_end_hold(p_job_id, 'charge') $$;

create function public.credit_release(p_job_id uuid)
returns setof public.credit_ledger
language sql
security definer
set search_path = ''
as $$ select * from public.credit_end_hold(p_job_id, 'release') $$;

-- Wallets whose cached balance/held disagree with their ledger. Expected: none.
create function public.credit_wallet_drift()
returns table (user_id uuid, balance int, held int, ledger_balance bigint, ledger_held bigint)
language sql
stable
set search_path = ''
as $$
  select w.user_id, w.balance, w.held, s.ledger_balance, s.ledger_held
    from public.credit_wallets w
    cross join lateral (
      select coalesce(sum(case l.kind when 'grant' then l.amount when 'charge' then -l.amount else 0 end), 0) as ledger_balance,
             coalesce(sum(case l.kind when 'hold' then l.amount when 'release' then -l.amount
                                      when 'charge' then -l.amount else 0 end), 0) as ledger_held
        from public.credit_ledger l where l.user_id = w.user_id) s
   where w.balance <> s.ledger_balance or w.held <> s.ledger_held
$$;

-- Privileges ----------------------------------------------------------------------------------------
-- The app reads its own wallet and activity (not who granted it); nobody writes the tables directly.

revoke all on public.credit_wallets, public.credit_ledger from anon, authenticated, service_role;
grant select on public.credit_wallets to authenticated, service_role;
grant select (id, user_id, kind, amount, balance_after, held_after, action, job_id, operation_key, note, created_at)
  on public.credit_ledger to authenticated;
grant select on public.credit_ledger to service_role;

revoke execute on function
  public.credit_ledger_append_only(), public.credit_lock_wallet(uuid), public.credit_refuse_disabled(uuid),
  public.credit_grant(uuid, int, text, text, text), public.credit_reserve(uuid, uuid, text, int),
  public.credit_end_hold(uuid, text), public.credit_settle(uuid), public.credit_release(uuid),
  public.credit_wallet_drift()
  from public, anon, authenticated, service_role;
grant execute on function
  public.credit_grant(uuid, int, text, text, text), public.credit_reserve(uuid, uuid, text, int),
  public.credit_settle(uuid), public.credit_release(uuid), public.credit_wallet_drift()
  to service_role;

alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;

create policy "Users read their own wallet" on public.credit_wallets
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users read their own credit activity" on public.credit_ledger
  for select to authenticated using ((select auth.uid()) = user_id);
