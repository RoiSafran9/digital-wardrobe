-- Activity logging L3: activation_events (First 3 Pieces) becomes activity_events, the record of meaningful
-- actions from the server (source 'server', from the verified token) and the app (source 'app', batched).
-- The allow-list of names and props lives in api/activity.py; here only the name's shape and the props' size.
-- Still backend-only (no client grants), still deleted with the account, purged after 180 days by the worker.
-- Safe on a database where activation_events was never created: then the table is created here.
do $$
begin
  if to_regclass('public.activation_events') is not null then
    alter table public.activation_events rename to activity_events;
    alter index public.activation_events_user_created rename to activity_events_user_created;
    alter index public.activation_events_created rename to activity_events_created;
    alter index public.activation_events_once rename to activity_events_once;
    alter table public.activity_events drop constraint if exists activation_events_event_check;
  else
    create table public.activity_events (
      id bigint generated always as identity primary key,
      user_id uuid not null references auth.users (id) on delete cascade,
      event text not null,
      props jsonb not null default '{}'::jsonb
        constraint activity_events_props_check check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1024),
      created_at timestamptz not null default now()
    );
    create index activity_events_user_created on public.activity_events (user_id, created_at);
    create index activity_events_created on public.activity_events (created_at);
    create unique index activity_events_once on public.activity_events (user_id, event)
      where event in ('first_garment_saved', 'first_3_saved', 'popup_shown');
  end if;
end $$;

alter table public.activity_events
  add constraint activity_events_event_shape check (event ~ '^[a-z][a-z0-9_]{2,47}$'),
  add column source text not null default 'app' check (source in ('app', 'server')),
  add column job_id uuid,   -- no foreign keys: events outlive swept scans and deleted items
  add column item_id uuid,
  add column session_id uuid,
  add column app_version text check (length(app_version) <= 20),
  add column client_event_id uuid,
  add column client_at timestamptz,
  add constraint activity_events_client_once unique (user_id, client_event_id);

revoke all on public.activity_events from anon, authenticated;
grant all on public.activity_events to service_role;
alter table public.activity_events enable row level security;
