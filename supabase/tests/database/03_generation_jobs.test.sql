-- Generation jobs: owners can read theirs; only the backend writes; keys and links stay within one user.
begin;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');

insert into public.wardrobe_items (id, user_id, facts, source_path, display_path) values
  ('a1111111-1111-4111-8111-11111111111a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/source.png', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/generated.png'),
  ('b1111111-1111-4111-8111-11111111111b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/items/b1/source.png', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/items/b1/generated.png');

insert into public.generation_jobs (id, user_id, item_id, kind, idempotency_key, input_path) values
  ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, 'garment', 'key-1',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/jobs/a0/upload.jpg'),
  ('a0000000-0000-4000-8000-0000000000ab', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-11111111111a', 'back', 'key-2', null),
  ('b0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', null, 'garment', 'key-1', null);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq('select id from public.generation_jobs order by id',
  $$values ('a0000000-0000-4000-8000-00000000000a'::uuid), ('a0000000-0000-4000-8000-0000000000ab'::uuid)$$,
  'a user sees only their own jobs');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'k')$$,
  '42501', null, 'jobs are created only by the backend');
select throws_ok($$update public.generation_jobs set status = 'succeeded'$$, '42501', null, 'users cannot change job status');
select throws_ok($$delete from public.generation_jobs$$, '42501', null, 'users cannot delete jobs');
reset role;

select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'key-1')$$,
  '23505', null, 'a retried request with the same key cannot start a second job');
select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'garment', 'key-2')$$,
  'keys are per user');
select throws_ok($$insert into public.generation_jobs (user_id, item_id, kind, idempotency_key)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1111111-1111-4111-8111-11111111111a', 'garment', 'k3')$$,
  '23514', null, 'a garment job does not belong to an existing item');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'turn', 'k4')$$,
  '23514', null, 'a back or 360 job needs its item');
select throws_ok($$insert into public.generation_jobs (user_id, item_id, kind, idempotency_key)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b1111111-1111-4111-8111-11111111111b', 'back', 'k5')$$,
  '23503', null, 'a job cannot target another user''s item');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, input_path)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'k6', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/jobs/x/upload.jpg')$$,
  '23514', null, 'a job cannot read an upload from another user''s folder');

delete from public.wardrobe_items where id = 'a1111111-1111-4111-8111-11111111111a';
select is((select count(*) from public.generation_jobs where id = 'a0000000-0000-4000-8000-0000000000ab'), 0::bigint,
  'deleting an item removes its back/360 jobs');

insert into public.wardrobe_items (id, user_id, job_id, piece_index, facts, source_path, display_path) values
  ('a2222222-2222-4222-8222-22222222222a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 0, '{}',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a2/source.png', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a2/generated.png');
delete from public.generation_jobs where id = 'a0000000-0000-4000-8000-00000000000a';
select results_eq($$select user_id, job_id, piece_index from public.wardrobe_items where id = 'a2222222-2222-4222-8222-22222222222a'$$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null::uuid, 0)$$,
  'deleting a job keeps the items it made, still owned by the same user');

delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select count(*) from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  + (select count(*) from public.wardrobe_items where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  + (select count(*) from public.generation_jobs where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint, 'deleting an account removes its profile, items and jobs');

select * from finish();
rollback;
