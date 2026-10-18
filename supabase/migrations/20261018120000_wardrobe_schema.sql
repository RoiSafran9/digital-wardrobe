-- Multi-user M2: user-owned profiles, wardrobe items and generation jobs.
-- The app (role "authenticated") may read its own rows and correct an item's facts or soft-delete it.
-- Everything else is written by the FastAPI backend with the secret key (service_role).
-- New tables are not auto-exposed on the hosted project, so privileges are granted explicitly below;
-- the local stack grants everything by default, so we revoke first to make both behave the same.

-- Profiles ------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generation jobs -----------------------------------------------------------------------------------

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid,  -- the item a back/360 job works on; same-owner FK added below
  kind text not null check (kind in ('garment', 'back', 'turn')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  input_path text check (input_path like user_id::text || '/%'),
  result jsonb,
  error text,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 2 check (max_attempts >= 1),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (user_id, idempotency_key),
  unique (id, user_id),
  check ((kind = 'garment') = (item_id is null))
);

create index generation_jobs_user_created on public.generation_jobs (user_id, created_at desc);
create index generation_jobs_claimable on public.generation_jobs (status, locked_until) where status in ('queued', 'running');

-- Wardrobe items ------------------------------------------------------------------------------------

create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid,
  piece_index int check (piece_index >= 0),
  tier text,
  facts jsonb not null check (jsonb_typeof(facts) = 'object'),
  facts_original jsonb,
  source_path text not null,
  source_kind text not null default 'original' check (source_kind in ('original', 'crop')),
  display_path text not null,
  cutout_path text,
  crop_path text,
  back jsonb,
  turn jsonb,
  legacy_key text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (job_id, piece_index),
  unique (user_id, legacy_key),
  check (job_id is null or piece_index is not null),  -- piece_index stays as history if the job is deleted
  -- Every file an item names lives in its owner's Storage folder.
  check (source_path like user_id::text || '/%'),
  check (display_path like user_id::text || '/%'),
  check (cutout_path like user_id::text || '/%'),
  check (crop_path like user_id::text || '/%'),
  -- An item can only come from its owner's job.
  foreign key (job_id, user_id) references public.generation_jobs (id, user_id) on delete set null (job_id)
);

-- A back/360 job can only target its owner's item.
alter table public.generation_jobs
  add foreign key (item_id, user_id) references public.wardrobe_items (id, user_id) on delete cascade;

create index wardrobe_items_user_created on public.wardrobe_items (user_id, created_at desc) where deleted_at is null;

create function public.wardrobe_items_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- Keep what the model said the first time someone corrects it.
  if new.facts is distinct from old.facts and old.facts_original is null then
    new.facts_original := old.facts;
  end if;
  return new;
end;
$$;

create trigger wardrobe_items_before_update
  before update on public.wardrobe_items
  for each row execute function public.wardrobe_items_touch();

-- Privileges ----------------------------------------------------------------------------------------

revoke all on public.profiles, public.wardrobe_items, public.generation_jobs from anon, authenticated;
grant select on public.profiles, public.wardrobe_items, public.generation_jobs to authenticated;
grant update (facts, deleted_at) on public.wardrobe_items to authenticated;
grant all on public.profiles, public.wardrobe_items, public.generation_jobs to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.wardrobe_items_touch() from public, anon, authenticated;

-- Row level security --------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.generation_jobs enable row level security;

create policy "Users read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "Users read their own items" on public.wardrobe_items
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users update their own items" on public.wardrobe_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read their own jobs" on public.generation_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
