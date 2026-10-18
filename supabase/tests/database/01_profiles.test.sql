-- Profiles: created on sign-up, readable only by their owner, never editable by the app.
begin;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');

select results_eq(
  $$select id, email, status from public.profiles
    where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') order by email$$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'a@test.dev'::text, 'active'::text),
           ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'b@test.dev'::text, 'active'::text)$$,
  'signing up creates one active profile per user');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint, 'every table in public has row level security on');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq('select id from public.profiles', $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'a user sees only their own profile');
select throws_ok($$update public.profiles set status = 'active'$$, '42501', null,
  'a user cannot change their profile (e.g. re-enable a disabled account)');

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok('select * from public.profiles', '42501', null, 'signed-out callers get nothing');

reset role;
select * from finish();
rollback;
