-- reports.*: the owner's read-only views; the app's keys can't reach them, and they carry no personal content.
begin;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');
insert into public.generation_jobs (id, user_id, kind, idempotency_key, status, created_at, finished_at, failure_code) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'k1', 'succeeded',
   '2026-10-22 10:00:00+00', '2026-10-22 10:00:40+00', null),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'k2', 'failed',
   '2026-10-22 11:00:00+00', '2026-10-22 11:01:00+00', 'no_garment');
insert into public.activity_events (user_id, event, props, source, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'signed_in', '{"first": true}', 'server', '2026-10-22 09:59:00+00');

set local role authenticated;
select throws_ok($$select * from reports.timeline$$, '42501', null, 'the app cannot read the timeline');
select throws_ok($$select * from reports.job_outcomes$$, '42501', null, 'nor job outcomes');
reset role;
set local role anon;
select throws_ok($$select * from reports.daily_active$$, '42501', null, 'nor can anyone signed out');
reset role;

select is_empty($$select column_name from information_schema.columns where table_schema = 'reports'
                  and (column_name in ('facts', 'email', 'display_name', 'facts_original') or column_name like '%path%')$$,
  'no personal content in any view');
select results_eq($$select what from reports.timeline where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                    and at < '2026-10-22 10:01:00+00' order by at$$,
  $$values ('signed_in'), ('job_started:garment'), ('job_succeeded:garment')$$, 'the timeline is in time order');
select results_eq($$select jobs, succeeded, failed from reports.job_outcomes where day = '2026-10-22' and kind = 'garment'$$,
  $$values (2::bigint, 1::bigint, 1::bigint)$$, 'job outcomes count successes and failures');
select is((select accounts from reports.daily_active where day = '2026-10-22'), 1::bigint, 'one active account that day');

select * from finish();
rollback;
