-- Name step at sign-up: what the app calls the user ("Good morning, Maya"). Written only by the backend
-- (PATCH /v1/profile); the owner reads it through the existing profile select policy.
alter table public.profiles
  add column display_name text
  check (display_name is null or (char_length(display_name) between 1 and 40 and display_name = btrim(display_name)));
