-- Private "wardrobe" bucket: each user reads only their own folder; the app never writes objects directly.
begin;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');

select results_eq($$select public from storage.buckets where id = 'wardrobe'$$, $$values (false)$$,
  'the wardrobe bucket exists and is private');

insert into storage.objects (bucket_id, name) values
  ('wardrobe', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/generated.png'),
  ('wardrobe', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/source.png'),
  ('wardrobe', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/items/b1/generated.png'),
  ('wardrobe', 'stray.png');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq($$select name from storage.objects where bucket_id = 'wardrobe' order by name$$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/generated.png'::text),
           ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/source.png'::text)$$,
  'a user sees only the files in their own folder (not other users'', not the bucket root)');
select is((select count(*) from storage.objects where name like 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/%'), 0::bigint,
  'asking for another user''s folder by name returns nothing');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('wardrobe', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/a1/x.png')$$,
  '42501', null, 'the app cannot upload into the bucket, even its own folder (the backend does)');
select results_eq(
  $$with u as (update storage.objects set metadata = '{"x": 1}' where name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/items/b1/generated.png' returning 1)
    select count(*) from u$$,
  $$values (0::bigint)$$, 'a user cannot change another user''s file');
-- Act like the Storage API, which lifts the SQL delete guard and leaves the decision to RLS.
set local storage.allow_delete_query = 'true';
select results_eq(
  $$with d as (delete from storage.objects where bucket_id = 'wardrobe' returning 1) select count(*) from d$$,
  $$values (0::bigint)$$, 'the app cannot delete files, its own or anyone else''s (the backend cleans up)');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((select count(*) from storage.objects where bucket_id = 'wardrobe'), 0::bigint, 'signed-out callers see no files');
reset role;

select is((select count(*) from storage.objects where bucket_id = 'wardrobe'), 4::bigint, 'all files are still there');

select * from finish();
rollback;
