-- AI Credits M2: per-action billing primitives. A garment job holds price × the fronts the user
-- approved, is charged only for the fronts made, and the rest goes back. Reconcile ends holds the
-- worker never ended (expired, crashed, never created).
begin;
select plan(26);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated');
do $$ begin perform public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 20, 'm2', 'test', 'owner'); end $$;

-- max_items on jobs ---------------------------------------------------------------------------------

select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, cost_credits, max_items)
                  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'cap', 1, 3)$$, 'a garment job records how many fronts were approved');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, max_items)
                  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'cap0', 0)$$, '23514', null, 'at least one front');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, max_items)
                  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'cap99', 21)$$, '23514', null, 'at most 20 fronts');

-- Partial settle ------------------------------------------------------------------------------------

do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000001', 'garment', 3); end $$;
select results_eq($$select kind, amount, balance_after, held_after from public.credit_settle('20000000-0000-4000-8000-000000000001', 2) order by id$$,
  $$values ('charge'::text, 2, 18, 1), ('release'::text, 1, 18, 0)$$, 'settling 2 of 3 charges 2 and gives 1 back');
select results_eq($$select kind, amount from public.credit_settle('20000000-0000-4000-8000-000000000001', 2) order by id$$,
  $$values ('charge'::text, 2), ('release'::text, 1)$$, 'settling again with the same amount returns the same rows');
select throws_ok($$select * from public.credit_settle('20000000-0000-4000-8000-000000000001', 3)$$, 'WC409', null,
  'settling again with another amount is refused');
select throws_ok($$select * from public.credit_release('20000000-0000-4000-8000-000000000001')$$, 'WC409', null,
  'a charged job cannot be released afterwards');

do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000002', 'garment', 2); end $$;
select results_eq($$select kind, amount from public.credit_settle('20000000-0000-4000-8000-000000000002', 0)$$,
  $$values ('release'::text, 2)$$, 'a job that made nothing is charged nothing');
select results_eq($$select kind from public.credit_release('20000000-0000-4000-8000-000000000002')$$,
  $$values ('release'::text)$$, '... which is the same as releasing it');
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000003', 'turn', 3); end $$;
select throws_ok($$select * from public.credit_settle('20000000-0000-4000-8000-000000000003', 4)$$, 'WC422', null,
  'a charge can never exceed the hold');
select throws_ok($$select * from public.credit_settle('20000000-0000-4000-8000-000000000003', -1)$$, 'WC422', null,
  'a charge cannot be negative');
select results_eq($$select kind, amount from public.credit_settle('20000000-0000-4000-8000-000000000003')$$,
  $$values ('charge'::text, 3)$$, 'with no amount, settle charges the whole hold');

-- Reconcile -----------------------------------------------------------------------------------------
-- Jobs in every state, each with a hold the worker never ended.

insert into public.generation_jobs (id, user_id, kind, idempotency_key, status, cost_credits, max_items, result, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'r-failed', 'failed', 1, 2, null, now()),
  ('30000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'r-ok', 'succeeded', 1, 3,
     '{"item_ids": ["x", "y"]}', now()),
  ('30000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'r-empty', 'succeeded', 1, 2,
     '{"item_ids": []}', now()),
  ('30000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'r-running', 'running', 1, 1, null, now()),
  ('30000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'r-canceled', 'canceled', 1, 1, null, now());
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000001', 'garment', 2); end $$;
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000002', 'garment', 3); end $$;
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000003', 'garment', 2); end $$;
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000004', 'garment', 1); end $$;
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000005', 'garment', 1); end $$;
-- A hold whose job was never created: one fresh, one stale.
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000006', 'back', 1); end $$;
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000007', 'back', 1); end $$;

select is((select held from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 11, 'eleven credits held before reconcile');

-- Reconcile with a 1-hour grace: the job-less holds are too new to touch.
select results_eq($$select job_id, kind, amount from public.credit_reconcile(3600) order by job_id, id$$,
  $$values ('30000000-0000-4000-8000-000000000001'::uuid, 'release'::text, 2),
           ('30000000-0000-4000-8000-000000000002'::uuid, 'charge'::text, 2),
           ('30000000-0000-4000-8000-000000000002'::uuid, 'release'::text, 1),
           ('30000000-0000-4000-8000-000000000003'::uuid, 'release'::text, 2),
           ('30000000-0000-4000-8000-000000000005'::uuid, 'release'::text, 1)$$,
  'reconcile releases failed/canceled jobs, charges finished ones for the fronts they made, and charges nothing for none');
select is((select count(*) from public.credit_ledger where job_id = '30000000-0000-4000-8000-000000000004' and kind <> 'hold'),
  0::bigint, 'a running job keeps its hold');
select is((select count(*) from public.credit_ledger where job_id in ('30000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000007')
            and kind <> 'hold'), 0::bigint, 'a fresh hold without a job is left alone (its request may still be running)');
select is_empty('select * from public.credit_reconcile(3600)', 'running reconcile again does nothing');

-- Zero grace: holds whose job never appeared are released.
select results_eq($$select job_id, kind from public.credit_reconcile(0) order by job_id$$,
  $$values ('30000000-0000-4000-8000-000000000006'::uuid, 'release'::text), ('30000000-0000-4000-8000-000000000007'::uuid, 'release'::text)$$,
  'a stale hold without a job is released');

-- The expired job: claim_generation_job fails it outside the worker; reconcile then releases it.
update public.generation_jobs set attempts = max_attempts, locked_until = now() - interval '1 minute'
 where id = '30000000-0000-4000-8000-000000000004';
do $$ begin perform public.claim_generation_job(60); end $$;
select is((select status from public.generation_jobs where id = '30000000-0000-4000-8000-000000000004'), 'failed',
  'the expired job was marked failed by the queue');
select results_eq($$select job_id, kind, amount from public.credit_reconcile(3600)$$,
  $$values ('30000000-0000-4000-8000-000000000004'::uuid, 'release'::text, 1)$$, '... and reconcile gives its hold back');

-- A finished turn job (no max_items) is charged its whole hold.
insert into public.generation_jobs (id, user_id, kind, idempotency_key, status, cost_credits, result) values
  ('30000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'garment', 'r-one', 'succeeded', 2, '{"item_ids": ["z"]}');
do $$ begin perform public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '30000000-0000-4000-8000-000000000008', 'garment', 2); end $$;
select results_eq($$select kind, amount from public.credit_reconcile(3600)$$, $$values ('charge'::text, 2)$$,
  'a job without max_items is charged one action at its price');

select results_eq($$select balance, held from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values (11, 0)$$, 'in the end: 20 granted − 2 − 3 − 2 − 2 charged, nothing held');
select is_empty('select * from public.credit_wallet_drift()', 'wallets still match their ledgers');

-- Privileges ----------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select throws_ok('select * from public.credit_reconcile(0)', '42501', null, 'the app cannot run reconcile');
select throws_ok($$select * from public.credit_settle('20000000-0000-4000-8000-000000000003', 1)$$, '42501', null, 'the app cannot settle');
reset role;
set local role service_role;
select lives_ok('select * from public.credit_reconcile(3600)', 'the backend can run reconcile');
reset role;

select * from finish();
rollback;
