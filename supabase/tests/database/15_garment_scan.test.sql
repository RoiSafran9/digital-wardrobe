-- garment_scan jobs are free; a garment job may come from one, with its picks.
begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');
insert into public.generation_jobs (id, user_id, kind, idempotency_key)
  values ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment_scan', 'gs');

select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, cost_credits)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment_scan', 'gs2', 1)$$, '23514', null, 'a garment scan is never priced');
select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, scan_job_id, candidate_ids, max_items)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'g', '33333333-3333-4333-8333-333333333333', '{p0,p2}', 2)$$,
  'a garment job can be made from a scan for the picked pieces');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, scan_job_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'g2', '33333333-3333-4333-8333-333333333333')$$,
  '23514', null, 'a job from a scan names its picks');
select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'g3')$$,
  'a plain garment job still works');

select * from finish();
rollback;
