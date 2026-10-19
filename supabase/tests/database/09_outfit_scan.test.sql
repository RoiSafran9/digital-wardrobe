-- Outfit scans: a free job kind with no item, read only by its owner.
begin;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');

select lives_ok($$insert into public.generation_jobs (id, user_id, kind, idempotency_key, input_path, result) values
  ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'scan-1',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/jobs/a0/upload.jpg', '{"candidates": []}')$$,
  'an outfit scan is a job without an item');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, cost_credits)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'scan-2', 1)$$,
  '23514', null, 'a scan can never be priced');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, max_items)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'scan-3', 2)$$,
  '23514', null, 'a scan approves no fronts');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, input_path)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'scan-4', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/jobs/x/upload.jpg')$$,
  '23514', null, 'a scan cannot read a photo from another user''s folder');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'turn', 'turn-1')$$,
  '23514', null, 'a 360 job still needs its item');

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';
select is((select count(*) from public.generation_jobs where kind = 'outfit_scan'), 0::bigint,
  'another user cannot see someone''s scan or its candidates');
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select is((select count(*) from public.generation_jobs where kind = 'outfit_scan'), 1::bigint, 'the owner sees their scan');
reset role;

select * from finish();
rollback;
