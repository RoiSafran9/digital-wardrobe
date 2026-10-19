-- outfit_regenerate jobs and corrections: shape rules only the backend writes against.
begin;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@test.dev', 'authenticated', 'authenticated');
insert into public.generation_jobs (id, user_id, kind, idempotency_key)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_scan', 'scan');
insert into public.wardrobe_items (id, user_id, tier, facts, source_path, display_path)
  values ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'high', '{}', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/x/source.jpg', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/items/x/generated.png');

select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, scan_job_id, candidate_ids, corrections)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_generate', 'g', '11111111-1111-4111-8111-111111111111', '{c1}', '{"c1": "blazer"}')$$,
  'a generate job can carry corrections');
select lives_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, item_id, scan_job_id, candidate_ids)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_regenerate', 'r', '22222222-2222-4222-8222-222222222222',
          '11111111-1111-4111-8111-111111111111', '{c1}')$$,
  'a regenerate job names its item, its scan and one garment');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, item_id, scan_job_id, candidate_ids)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_regenerate', 'r2', '22222222-2222-4222-8222-222222222222',
          '11111111-1111-4111-8111-111111111111', '{c1,c2}')$$,
  '23514', null, 'a regenerate job makes exactly one garment');
select throws_ok($$insert into public.generation_jobs (user_id, kind, idempotency_key, scan_job_id, candidate_ids)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'outfit_regenerate', 'r3', '11111111-1111-4111-8111-111111111111', '{c1}')$$,
  '23514', null, 'a regenerate job needs its item');

select * from finish();
rollback;
