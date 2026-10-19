-- Outfit generate jobs: tied to the same user's scan, with 1-8 picked candidates; outfit items wait for review.
begin;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');

insert into public.generation_jobs (id, user_id, kind, idempotency_key, status) values
  ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'scan-a', 'succeeded'),
  ('b0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'outfit_scan', 'scan-b', 'succeeded');

select lives_ok($$insert into public.generation_jobs (id, user_id, kind, idempotency_key, scan_job_id, candidate_ids, cost_credits, max_items)
  values ('a1000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_generate', 'gen-1',
          'a0000000-0000-4000-8000-00000000000a', '{c1,c3}', 1, 2)$$,
  'a generate job reads its owner''s scan and may hold one front per pick');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, scan_job_id, candidate_ids)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_generate', 'gen-2', 'b0000000-0000-4000-8000-00000000000b', '{c1}')$$,
  '23503', null, 'a generate job cannot read another user''s scan');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, candidate_ids)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_generate', 'gen-3', '{c1}')$$,
  '23514', null, 'a generate job needs its scan');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, scan_job_id, candidate_ids)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_generate', 'gen-4', 'a0000000-0000-4000-8000-00000000000a', '{}')$$,
  '23514', null, 'a generate job needs at least one pick');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, scan_job_id, candidate_ids)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'gen-5', 'a0000000-0000-4000-8000-00000000000a', '{c1}')$$,
  '23514', null, 'only generate jobs (and garment jobs from a pre-scan) point at a scan');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, max_items) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'scan-x', 1)$$,
  '23514', null, 'a scan still approves no fronts');

insert into public.wardrobe_items (id, user_id, job_id, piece_index, facts, source_path, source_kind, display_path, origin, review_state) values
  ('a2222222-2222-4222-8222-22222222222a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-00000000000a', 1, '{}',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a2/crop.jpg', 'crop', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a2/generated.png',
   'outfit_photo', 'pending');
select results_eq($$select origin, review_state from public.wardrobe_items where id = 'a2222222-2222-4222-8222-22222222222a'$$,
  $$values ('outfit_photo'::text, 'pending'::text)$$, 'an outfit item records its origin and waits for review');
select throws_ok($$update public.wardrobe_items set review_state = 'maybe' where id = 'a2222222-2222-4222-8222-22222222222a'$$,
  '23514', null, 'review_state is pending or kept');

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';
select is((select count(*) from public.generation_jobs where kind = 'outfit_generate'), 0::bigint,
  'another user cannot see someone''s generate job or picks');
reset role;

select * from finish();
rollback;
