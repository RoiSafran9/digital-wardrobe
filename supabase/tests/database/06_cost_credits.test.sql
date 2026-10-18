-- generation_jobs.cost_credits: what a job costs in AI Credits (null while billing is off).
begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');

select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'free')$$,
  'a job without a cost is fine (billing off)');
select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, cost_credits) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'paid', 3)$$,
  'a job records its cost');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, cost_credits) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'neg', -1)$$,
  '23514', null, 'a cost cannot be negative');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select results_eq($$select cost_credits from public.generation_jobs where idempotency_key = 'paid'$$, $$values (3)$$,
  'users can see what their jobs cost');
reset role;

select * from finish();
rollback;
