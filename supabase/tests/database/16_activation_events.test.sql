-- activation_events: backend-only; apps can neither read nor write them; milestones once; gone with the account.
begin;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');
insert into public.activation_events (user_id, event, props) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'onboarding_started', '{"entry": "auto"}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'popup_shown', '{"saved": 2}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select throws_ok($$select * from public.activation_events$$, '42501', null, 'the app cannot read events, not even its own');
select throws_ok($$insert into public.activation_events (user_id, event) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'popup_add_more')$$,
  '42501', null, 'the app cannot write events');
reset role;

select throws_ok($$insert into public.activation_events (user_id, event) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'popup_shown')$$,
  '23505', null, 'a milestone is recorded once per account');
select lives_ok($$insert into public.activation_events (user_id, event) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'onboarding_started')$$,
  'ordinary steps can repeat');
select throws_ok($$insert into public.activation_events (user_id, event) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'photo_uploaded')$$,
  '23514', null, 'only listed events');
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is_empty($$select 1 from public.activation_events$$, 'deleting the account removes its events');

select * from finish();
rollback;
