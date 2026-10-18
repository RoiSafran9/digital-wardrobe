-- AI Credits wallet: one wallet per account, an append-only ledger, and four backend-only operations.
-- Billing is off; these tests prove the primitives before anything charges for real.
begin;
select plan(66);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', 'authenticated', 'authenticated'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'd@test.dev', 'authenticated', 'authenticated');
update public.profiles set status = 'disabled' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

-- Schema ---------------------------------------------------------------------------------------------

select has_table('public', 'credit_wallets', 'the wallet table exists');
select has_table('public', 'credit_ledger', 'the ledger table exists');
select results_eq($$select balance, held from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values (0, 0)$$, 'signing up creates an empty wallet');
select is((select count(*) from auth.users u where not exists (select 1 from public.credit_wallets w where w.user_id = u.id)),
  0::bigint, 'every account has a wallet (existing accounts backfilled)');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('credit_grant', 'credit_reserve', 'credit_settle', 'credit_release')
              and p.prosecdef and p.proconfig @> array['search_path=""']),
  4::bigint, 'the four credit operations are security definer with an empty search_path');

-- Grants ---------------------------------------------------------------------------------------------

select results_eq($$select kind, amount, balance_after, held_after, operation_key, note from public.credit_grant(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 'ff-1', 'F&F pilot', 'owner')$$,
  $$values ('grant'::text, 10, 10, 0, 'grant:ff-1'::text, 'F&F pilot'::text)$$, 'an admin grant adds to the balance');
select results_eq($$select kind, amount from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 'ff-1', 'F&F pilot', 'owner')$$,
  $$values ('grant'::text, 10)$$, 'repeating a grant with the same key returns the first grant');
select is((select balance from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 10,
  '... and does not add again');
select is((select count(*) from public.credit_ledger where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1::bigint,
  '... nor write a second ledger row');
select throws_ok($$select * from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 99, 'ff-1', 'F&F pilot', 'owner')$$,
  'WC422', null, 'reusing a grant key with a different amount is refused');
select throws_ok($$select * from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, 'ff-2', 'x', 'owner')$$,
  'WC422', null, 'a zero grant is refused');
select throws_ok($$select * from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', -5, 'ff-2', 'x', 'owner')$$,
  'WC422', null, 'a negative grant is refused');
select throws_ok($$select * from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5, 'ff-2', ' ', 'owner')$$,
  'WC422', null, 'a grant needs a reason');
select throws_ok($$select * from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5, 'ff-2', 'x', null)$$,
  'WC422', null, 'a grant needs the admin who gave it');
select throws_ok($$select * from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5, '', 'x', 'owner')$$,
  'WC422', null, 'a grant needs an operation key');
select throws_ok($$select * from public.credit_grant('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 5, 'ff-2', 'x', 'owner')$$,
  'WC404', null, 'a grant to an unknown user is refused');
select throws_ok($$select * from public.credit_grant(null, 5, 'ff-2', 'x', 'owner')$$,
  'WC404', null, 'a grant without a user is refused');
select throws_ok($$select * from public.credit_grant('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 5, 'ff-2', 'x', 'owner')$$,
  'WC403', null, 'a grant to a disabled account is refused');

-- Reserve / settle / release -------------------------------------------------------------------------

select results_eq($$select kind, amount, action, balance_after, held_after, operation_key from public.credit_reserve(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'garment', 3)$$,
  $$values ('hold'::text, 3, 'garment'::text, 10, 3, 'job:10000000-0000-4000-8000-000000000001:hold'::text)$$,
  'reserving holds the cost without spending it');
select results_eq($$select kind, amount from public.credit_reserve(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'garment', 3)$$,
  $$values ('hold'::text, 3)$$, 'reserving the same job again returns the first hold');
select is((select held from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 3,
  '... and holds nothing more');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'garment', 4)$$,
  'WC422', null, 'the same job with a different cost is refused');
select throws_ok($$select * from public.credit_reserve('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '10000000-0000-4000-8000-000000000001', 'garment', 3)$$,
  'WC422', null, 'another user cannot reuse a job id that already holds credits');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', 'turn', 8)$$,
  'WC402', null, 'reserving more than is available is refused');
select results_eq($$select held_after from public.credit_reserve(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000002', 'turn', 7)$$,
  $$values (10)$$, 'reserving exactly what is available works');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000003', 'back', 1)$$,
  'WC402', null, 'with nothing available, any reserve is refused');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000004', 'garment', 0)$$,
  'WC422', null, 'a zero reserve is refused');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000004', 'garment', -1)$$,
  'WC422', null, 'a negative reserve is refused');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000004', 'regenerate', 1)$$,
  'WC422', null, 'an unknown action is refused');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, 'garment', 1)$$,
  'WC422', null, 'a reserve needs a job id');
select throws_ok($$select * from public.credit_reserve('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '10000000-0000-4000-8000-000000000004', 'garment', 1)$$,
  'WC404', null, 'a reserve for an unknown user is refused');
select throws_ok($$select * from public.credit_reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '10000000-0000-4000-8000-000000000004', 'garment', 1)$$,
  'WC403', null, 'a disabled account cannot reserve');

select results_eq($$select kind, amount, balance_after, held_after from public.credit_settle('10000000-0000-4000-8000-000000000001')$$,
  $$values ('charge'::text, 3, 7, 7)$$, 'settling turns the hold into a charge');
select results_eq($$select kind, balance_after from public.credit_settle('10000000-0000-4000-8000-000000000001')$$,
  $$values ('charge'::text, 7)$$, 'settling again returns the same charge');
select is((select balance from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 7,
  '... without charging twice');
select throws_ok($$select * from public.credit_release('10000000-0000-4000-8000-000000000001')$$,
  'WC409', null, 'a charged job cannot be released');

-- A job that fails for good: its hold goes back.
select results_eq($$select kind, amount, balance_after, held_after from public.credit_release('10000000-0000-4000-8000-000000000002')$$,
  $$values ('release'::text, 7, 7, 0)$$, 'releasing a failed job gives the held credits back');
select results_eq($$select kind from public.credit_release('10000000-0000-4000-8000-000000000002')$$,
  $$values ('release'::text)$$, 'releasing again returns the same release');
select is((select held from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0,
  '... and releases nothing more');
select throws_ok($$select * from public.credit_settle('10000000-0000-4000-8000-000000000002')$$,
  'WC409', null, 'a released job cannot be charged');
select is((select count(*) from public.credit_settle('10000000-0000-4000-8000-000000000009')), 0::bigint,
  'settling a job that holds nothing does nothing (billing off)');
select is((select count(*) from public.credit_release('10000000-0000-4000-8000-000000000009')), 0::bigint,
  'releasing a job that holds nothing does nothing');

select results_eq($$select kind, amount, balance_after, held_after from public.credit_ledger
                     where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by id$$,
  $$values ('grant'::text, 10, 10, 0), ('hold', 3, 10, 3), ('hold', 7, 10, 10), ('charge', 3, 7, 7), ('release', 7, 7, 0)$$,
  'the ledger tells the whole story in order');
select is_empty('select * from public.credit_wallet_drift()', 'every wallet matches the sum of its ledger');

-- Who can read and write -----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';
select results_eq('select user_id, balance, held from public.credit_wallets',
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 7, 0)$$, 'a user sees only their own wallet');
select is((select count(*) from public.credit_ledger where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 5::bigint,
  'a user sees their own credit activity');
select throws_ok('select granted_by from public.credit_ledger', '42501', null, 'a user cannot see which admin granted credits');
select throws_ok($$update public.credit_wallets set balance = 1000$$, '42501', null, 'a user cannot change their balance');
select throws_ok($$insert into public.credit_wallets (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, '42501', null,
  'a user cannot create a wallet');
select throws_ok($$insert into public.credit_ledger (user_id, kind, amount, balance_after, held_after, operation_key, note, granted_by)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'grant', 1000, 1000, 0, 'x', 'x', 'x')$$, '42501', null,
  'a user cannot write credit activity');
select throws_ok('delete from public.credit_ledger', '42501', null, 'a user cannot delete credit activity');
select throws_ok($$select * from public.credit_grant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1000, 'self', 'x', 'me')$$, '42501', null,
  'a user cannot grant themselves credits');
select throws_ok($$select * from public.credit_release('10000000-0000-4000-8000-000000000001')$$, '42501', null,
  'a user cannot release holds');
select throws_ok('select * from public.credit_wallet_drift()', '42501', null, 'a user cannot run the drift check');

set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';
select results_eq('select user_id, balance from public.credit_wallets',
  $$values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 0)$$, 'another user sees only their own (empty) wallet');
select is_empty('select id from public.credit_ledger', 'another user sees none of the first user''s activity');
reset role;

set local role anon;
select throws_ok('select user_id from public.credit_wallets', '42501', null, 'signed-out visitors cannot read wallets');
select throws_ok($$select * from public.credit_reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000005', 'garment', 1)$$,
  '42501', null, 'signed-out visitors cannot reserve');
reset role;

set local role service_role;
select throws_ok($$update public.credit_wallets set balance = 1000$$, '42501', null,
  'even the backend cannot change a balance except through the credit operations');
select throws_ok($$insert into public.credit_ledger (user_id, kind, amount, balance_after, held_after, operation_key, note, granted_by)
                   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'grant', 1000, 1000, 0, 'x', 'x', 'x')$$, '42501', null,
  'even the backend cannot write the ledger directly');
select lives_ok($$select * from public.credit_grant('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2, 'ff-b', 'F&F pilot', 'owner')$$,
  'the backend can grant through the operation');
reset role;

-- Append-only, even for the database owner -----------------------------------------------------------

select throws_ok($$update public.credit_ledger set amount = 1000$$, 'WC405', null, 'ledger rows cannot be changed');
select throws_ok($$delete from public.credit_ledger where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'WC405', null,
  'ledger rows cannot be deleted while the account exists');

-- Account deletion takes the wallet and its history with it.
select lives_ok($$delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'an account can still be deleted');
select is((select count(*) from public.credit_ledger where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
         + (select count(*) from public.credit_wallets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint, '... removing its wallet and credit activity');
select is_empty('select * from public.credit_wallet_drift()', 'wallets still match their ledgers at the end');

select * from finish();
rollback;
