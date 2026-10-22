-- ai_calls: backend-only cost rows per model call; kept without the account or job when those are deleted.
begin;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');
insert into public.generation_jobs (id, user_id, kind, idempotency_key) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'k1');
insert into public.ai_calls (job_id, user_id, job_kind, stage, model, status, latency_ms, input_tokens, output_tokens,
                             images_out, est_cost_usd) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'stage4_generate',
   'gemini-2.5-flash-image', 'ok', 9000, 1200, 1290, 1, 0.03936);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select throws_ok($$select * from public.ai_calls$$, '42501', null, 'the app cannot read cost rows, not even its own');
select throws_ok($$insert into public.ai_calls (stage, model, status) values ('s', 'm', 'ok')$$, '42501', null,
  'the app cannot write cost rows');
reset role;

select throws_ok($$insert into public.ai_calls (stage, model, status) values ('s', 'm', 'maybe')$$, '23514', null,
  'status is ok or error');
select throws_ok($$update public.generation_jobs set failure_code = 'bad_luck' where id = '11111111-1111-4111-8111-111111111111'$$,
  '23514', null, 'only listed failure codes');
select lives_ok($$update public.generation_jobs set failure_code = 'model_timeout' where id = '11111111-1111-4111-8111-111111111111'$$,
  'a listed failure code is accepted');

delete from public.generation_jobs where id = '11111111-1111-4111-8111-111111111111';
select is((select job_id from public.ai_calls), null, 'deleting the job keeps the cost row without it');
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select results_eq($$select user_id is null, est_cost_usd from public.ai_calls$$,
  $$values (true, 0.03936::numeric(10,5))$$, 'deleting the account keeps the cost without the account (D1)');

select * from finish();
rollback;
