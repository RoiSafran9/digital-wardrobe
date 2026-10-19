-- push_tokens: backend-only; apps can neither read nor write them, tokens go with the account.
begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');
insert into public.push_tokens (user_id, token) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ExponentPushToken[a]');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select throws_ok($$select * from public.push_tokens$$, '42501', null, 'the app cannot read push tokens, not even its own');
select throws_ok($$insert into public.push_tokens (user_id, token) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x')$$,
  '42501', null, 'the app cannot write push tokens');
reset role;

select throws_ok($$insert into public.push_tokens (user_id, token) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ExponentPushToken[a]')$$,
  '23505', null, 'a token is stored once per account');
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is_empty($$select 1 from public.push_tokens$$, 'deleting the account removes its tokens');

select * from finish();
rollback;
