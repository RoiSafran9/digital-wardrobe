-- Outfit follow-ups: the types a user corrected before generating, and making a pending outfit result
-- again ('outfit_regenerate', one front image on an existing item, reading the same scan).
alter table public.generation_jobs
  add column corrections jsonb check (corrections is null or jsonb_typeof(corrections) = 'object');

alter table public.generation_jobs
  drop constraint generation_jobs_kind_check,
  add constraint generation_jobs_kind_check
    check (kind in ('garment', 'back', 'turn', 'outfit_scan', 'outfit_generate', 'outfit_regenerate'));

alter table public.generation_jobs
  drop constraint generation_jobs_item_check,
  add constraint generation_jobs_item_check check ((kind in ('back', 'turn', 'outfit_regenerate')) = (item_id is not null));

alter table public.generation_jobs
  drop constraint generation_jobs_outfit_generate_check,
  add constraint generation_jobs_outfit_generate_check check (
    (kind in ('outfit_generate', 'outfit_regenerate')) = (scan_job_id is not null)
    and (kind in ('outfit_generate', 'outfit_regenerate')) = (candidate_ids is not null)
    and (candidate_ids is null or cardinality(candidate_ids) between 1 and 8)
    and (kind <> 'outfit_regenerate' or cardinality(candidate_ids) = 1));
