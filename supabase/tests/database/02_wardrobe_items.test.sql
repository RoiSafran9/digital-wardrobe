-- Wardrobe items: owners read theirs and may edit only facts and deleted_at; rows can't point at another user's data.
begin;
select plan(20);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');

insert into public.generation_jobs (id, user_id, kind, idempotency_key) values
  ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'a-photo-1'),
  ('b0000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'garment', 'b-photo-1');

insert into public.wardrobe_items (id, user_id, job_id, piece_index, facts, source_path, display_path, legacy_key, updated_at) values
  ('a1111111-1111-4111-8111-11111111111a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 0,
   '{"category": "shorts"}', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/source.png',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/generated.png', 'run1/photo/item_0', '2026-01-01'),
  ('b1111111-1111-4111-8111-11111111111b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b0000000-0000-4000-8000-00000000000b', 0,
   '{"category": "jacket"}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/items/b1/source.png',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/items/b1/generated.png', null, '2026-01-01');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq('select id from public.wardrobe_items', $$values ('a1111111-1111-4111-8111-11111111111a'::uuid)$$,
  'a user sees only their own items');
select results_eq(
  $$with u as (update public.wardrobe_items set facts = '{"category": "hacked"}'
               where id = 'b1111111-1111-4111-8111-11111111111b' returning 1) select count(*) from u$$,
  $$values (0::bigint)$$, 'editing another user''s item changes nothing');
select results_eq(
  $$with u as (update public.wardrobe_items set facts = '{"category": "pants"}'
               where id = 'a1111111-1111-4111-8111-11111111111a' returning 1) select count(*) from u$$,
  $$values (1::bigint)$$, 'a user can correct the facts of their own item');
select lives_ok($$update public.wardrobe_items set facts = '{"category": "jeans"}' where id = 'a1111111-1111-4111-8111-11111111111a'$$,
  'a second correction works too');
select lives_ok($$update public.wardrobe_items set deleted_at = now() where id = 'a1111111-1111-4111-8111-11111111111a'$$,
  'a user can soft-delete their own item');
select lives_ok($$update public.wardrobe_items set deleted_at = null where id = 'a1111111-1111-4111-8111-11111111111a'$$,
  'and restore it');
select throws_ok($$update public.wardrobe_items set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'a1111111-1111-4111-8111-11111111111a'$$,
  '42501', null, 'a user cannot hand an item to someone else');
select throws_ok($$update public.wardrobe_items set display_path = 'x' where id = 'a1111111-1111-4111-8111-11111111111a'$$,
  '42501', null, 'a user cannot swap the catalog image');
select throws_ok($$update public.wardrobe_items set source_path = 'x' where id = 'a1111111-1111-4111-8111-11111111111a'$$,
  '42501', null, 'a user cannot swap the original photo');
select throws_ok($$insert into public.wardrobe_items (user_id, facts, source_path, display_path)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/s', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d')$$,
  '42501', null, 'items are created only by the backend');
select throws_ok($$delete from public.wardrobe_items where id = 'a1111111-1111-4111-8111-11111111111a'$$,
  '42501', null, 'items are hard-deleted only by the backend');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok('select * from public.wardrobe_items', '42501', null, 'signed-out callers get nothing');
reset role;

select is((select facts from public.wardrobe_items where id = 'b1111111-1111-4111-8111-11111111111b'),
  '{"category": "jacket"}'::jsonb, 'the other user''s item is untouched');
select is((select facts_original from public.wardrobe_items where id = 'a1111111-1111-4111-8111-11111111111a'),
  '{"category": "shorts"}'::jsonb, 'the model''s original facts are kept after edits');
select ok((select updated_at > '2026-01-01' from public.wardrobe_items where id = 'a1111111-1111-4111-8111-11111111111a'),
  'edits bump updated_at');

select throws_ok($$insert into public.wardrobe_items (user_id, facts, source_path, display_path)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/items/x/source.png',
                           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/x/generated.png')$$,
  '23514', null, 'an item cannot point at a file in another user''s folder');
select throws_ok($$insert into public.wardrobe_items (user_id, job_id, piece_index, facts, source_path, display_path)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-00000000000b', 1, '{}',
                           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/s', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d')$$,
  '23503', null, 'an item cannot belong to another user''s job');
select throws_ok($$insert into public.wardrobe_items (user_id, facts, source_path, display_path, legacy_key)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/s',
                           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d', 'run1/photo/item_0')$$,
  '23505', null, 'migrating the same local item twice is refused');
select throws_ok($$insert into public.wardrobe_items (user_id, job_id, piece_index, facts, source_path, display_path)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', 0, '{}',
                           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/s', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d')$$,
  '23505', null, 'a retried job cannot create the same piece twice');
select throws_ok($$insert into public.wardrobe_items (user_id, job_id, facts, source_path, display_path)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-00000000000a', '{}',
                           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/s', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d')$$,
  '23514', null, 'an item from a job must say which piece it is');

select * from finish();
rollback;
