-- First 3 Pieces activation analytics (api/events.py): a fixed list of onboarding steps per account.
-- Written and read only by the backend (POST /v1/events, scripts/activation_report.py); the app never
-- touches this table directly. No photos, free text or device data: the step, a few allow-listed
-- counts/choices, and the server's time. Rows go with the account; the worker purges them after 180 days.
create table public.activation_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (event in ('onboarding_started', 'path_selected', 'photos_collected', 'detection_completed',
                                       'generation_started', 'first_garment_saved', 'first_3_saved', 'popup_shown',
                                       'popup_add_more', 'onboarding_abandoned')),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1024),
  created_at timestamptz not null default now()
);

create index activation_events_user_created on public.activation_events (user_id, created_at);
create index activation_events_created on public.activation_events (created_at);
-- Milestones count once per account.
create unique index activation_events_once on public.activation_events (user_id, event)
  where event in ('first_garment_saved', 'first_3_saved', 'popup_shown');

revoke all on public.activation_events from anon, authenticated;
grant all on public.activation_events to service_role;
alter table public.activation_events enable row level security;
