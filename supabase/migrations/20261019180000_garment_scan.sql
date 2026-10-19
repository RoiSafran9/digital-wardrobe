-- Garment pre-scan (redesign follow-up, spec D6 b): a free 'garment_scan' job finds the pieces in a garment
-- photo; a 'garment' job can then be made from it for the picked pieces only (scan_job_id + candidate_ids
-- 'p0'…), reusing the stored detection. Garment jobs without a scan keep their old rules.
alter table public.generation_jobs
  drop constraint generation_jobs_kind_check,
  add constraint generation_jobs_kind_check
    check (kind in ('garment', 'back', 'turn', 'outfit_scan', 'outfit_generate', 'outfit_regenerate', 'garment_scan'));

alter table public.generation_jobs
  add constraint generation_jobs_garment_scan_free check (kind <> 'garment_scan' or (cost_credits is null and max_items is null));

alter table public.generation_jobs
  drop constraint generation_jobs_outfit_generate_check,
  add constraint generation_jobs_outfit_generate_check check (
    (kind not in ('outfit_generate', 'outfit_regenerate') or (scan_job_id is not null and candidate_ids is not null))
    and (scan_job_id is null or kind in ('garment', 'outfit_generate', 'outfit_regenerate'))
    and ((scan_job_id is null) = (candidate_ids is null))
    and (candidate_ids is null or cardinality(candidate_ids) between 1 and 20)
    and (kind not in ('outfit_generate', 'outfit_regenerate') or cardinality(candidate_ids) <= 8)
    and (kind <> 'outfit_regenerate' or cardinality(candidate_ids) = 1));
