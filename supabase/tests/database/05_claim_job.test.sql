-- claim_generation_job: the worker's queue. Oldest first, one claimer per job, crashed jobs come back.
begin;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');

insert into public.generation_jobs (id, user_id, kind, idempotency_key, status, attempts, locked_until, created_at) values
  ('00000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'fresh-running', 'running', 1, now() + interval '5 minutes', now() - interval '9 minutes'),
  ('00000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'dead-last-try', 'running', 2, now() - interval '1 minute', now() - interval '8 minutes'),
  ('00000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'crashed', 'running', 1, now() - interval '1 minute', now() - interval '7 minutes'),
  ('00000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'older-queued', 'queued', 0, null, now() - interval '6 minutes'),
  ('00000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'newer-queued', 'queued', 0, null, now() - interval '5 minutes'),
  ('00000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'done', 'succeeded', 1, null, now() - interval '10 minutes');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select throws_ok('select * from public.claim_generation_job(60)', '42501', null, 'the app cannot claim jobs');
reset role;

set local role service_role;
select results_eq('select id, attempts from public.claim_generation_job(60)',
  $$values ('00000000-0000-4000-8000-000000000003'::uuid, 2)$$, 'a crashed job whose lease ran out is claimed first (oldest), attempt 2');
select results_eq('select id, status from public.claim_generation_job(60)',
  $$values ('00000000-0000-4000-8000-000000000004'::uuid, 'running'::text)$$, 'then the oldest queued job');
select results_eq('select id from public.claim_generation_job(60)',
  $$values ('00000000-0000-4000-8000-000000000005'::uuid)$$, 'then the next');
select is((select count(*) from public.claim_generation_job(60)), 0::bigint, 'running jobs with a live lease are left alone');
reset role;

select results_eq($$select status, error from public.generation_jobs where id = '00000000-0000-4000-8000-000000000002'$$,
  $$values ('failed'::text, 'Interrupted — try again'::text)$$, 'a job that died on its last attempt is marked failed');
select ok((select locked_until > now() and started_at is not null from public.generation_jobs where id = '00000000-0000-4000-8000-000000000004'),
  'a claimed job gets a lease and a start time');
select is((select status from public.generation_jobs where id = '00000000-0000-4000-8000-000000000006'), 'succeeded',
  'finished jobs are never claimed');

select * from finish();
rollback;
