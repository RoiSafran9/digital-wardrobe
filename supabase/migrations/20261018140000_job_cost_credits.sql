-- Multi-user M5: what each job costs in AI Credits. Null while billing is off (no price list).
-- Written only by the backend; users can read it on their own jobs (existing select policy/grant).
alter table public.generation_jobs
  add column cost_credits int check (cost_credits >= 0);
