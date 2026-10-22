-- activity_events (was activation_events): backend-only; apps can neither read nor write them; names have a
-- fixed shape; app retries are no-ops; milestones once; gone with the account.
begin;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');
insert into public.activity_events (user_id, event, props) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'onboarding_started', '{"entry": "auto"}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'popup_shown', '{"saved": 2}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select throws_ok($$select * from public.activity_events$$, '42501', null, 'the app cannot read events, not even its own');
select throws_ok($$insert into public.activity_events (user_id, event) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'popup_add_more')$$,
  '42501', null, 'the app cannot write events');
reset role;

select is((select source from public.activity_events limit 1), 'app', 'existing rows count as app events');
select throws_ok($$insert into public.activity_events (user_id, event) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'popup_shown')$$,
  '23505', null, 'a milestone is recorded once per account');
select lives_ok($$insert into public.activity_events (user_id, event, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'item_edited', 'server')$$,
  'any well-formed name; the allow-list lives in api/activity.py');
select throws_ok($$insert into public.activity_events (user_id, event) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Photo Uploaded!')$$,
  '23514', null, 'names have a fixed shape');
select throws_ok($$insert into public.activity_events (user_id, event, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x_event', 'phone')$$,
  '23514', null, 'source is app or server');
select lives_ok($$insert into public.activity_events (user_id, event, client_event_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'app_opened', '99999999-9999-4999-8999-999999999999')$$, 'an app event with its id');
select throws_ok($$insert into public.activity_events (user_id, event, client_event_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'app_opened', '99999999-9999-4999-8999-999999999999')$$,
  '23505', null, 'a resent app event is refused (the API ignores it)');
select throws_ok($$insert into public.activity_events (user_id, event, props) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'app_opened', '[1]')$$, '23514', null, 'props are an object');
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is_empty($$select 1 from public.activity_events$$, 'deleting the account removes its events');

select * from finish();
rollback;
