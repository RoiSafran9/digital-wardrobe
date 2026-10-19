-- 'Notify when ready': Expo push tokens per account. Written and read only by the backend (the worker
-- sends a push when a job finishes); the app never touches this table directly.
create table public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null check (char_length(token) between 1 and 300),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

revoke all on public.push_tokens from anon, authenticated;
grant all on public.push_tokens to service_role;
alter table public.push_tokens enable row level security;
