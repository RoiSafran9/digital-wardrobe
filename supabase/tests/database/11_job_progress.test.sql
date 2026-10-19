-- generation_jobs.progress: written by the backend, readable (not writable) by the job's owner only.
begin;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');

insert into public.generation_jobs (user_id, kind, idempotency_key, progress)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'p1', '{"done": 1, "total": 3}');

select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, progress) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'bad', '{"done": "x"}')$$,
  '23514', null, 'progress must have numeric done and total');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select results_eq($$select (progress ->> 'done')::int from public.generation_jobs where idempotency_key = 'p1'$$, $$values (1)$$,
  'the owner can read the progress of their job');
select throws_ok($$update public.generation_jobs set progress = '{"done": 3, "total": 3}' where idempotency_key = 'p1'$$,
  '42501', null, 'the owner cannot write progress');

set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';
select is_empty($$select 1 from public.generation_jobs where idempotency_key = 'p1'$$, 'another account cannot see the job');
reset role;

select results_eq($$select (progress ->> 'done')::int from public.generation_jobs where idempotency_key = 'p1'$$, $$values (1)$$,
  'nothing changed the progress');

select * from finish();
rollback;
