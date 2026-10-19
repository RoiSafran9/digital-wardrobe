-- Outfit Photo M2: generate catalog images ONLY for the candidates the user picked from a scan, then
-- let them keep or discard each result. Uses the existing wallet: one front-image action ('garment'
-- price) per selected candidate, held when the user confirms and charged per image actually made.
-- Behind WARDROBE_OUTFIT=on in the API. Existing jobs and items keep their old rules.

alter table public.generation_jobs
  drop constraint generation_jobs_kind_check,
  add constraint generation_jobs_kind_check check (kind in ('garment', 'back', 'turn', 'outfit_scan', 'outfit_generate'));

-- The scan a generate job reads, and the candidate IDs the user picked (1-8, from that scan).
alter table public.generation_jobs
  add column scan_job_id uuid,
  add column candidate_ids text[],
  add foreign key (scan_job_id, user_id) references public.generation_jobs (id, user_id) on delete cascade,
  add constraint generation_jobs_outfit_generate_check check (
    (kind = 'outfit_generate') = (scan_job_id is not null)
    and (kind = 'outfit_generate') = (candidate_ids is not null)
    and (candidate_ids is null or cardinality(candidate_ids) between 1 and 8));

-- Fronts approved: garment jobs as before, and now one per selected candidate.
alter table public.generation_jobs
  drop constraint generation_jobs_check2,
  add constraint generation_jobs_max_items_kind_check check (max_items is null or kind in ('garment', 'outfit_generate'));

-- Where an item came from, and whether its owner has accepted it yet. Outfit results wait in
-- 'pending' (hidden from the closet) until the user keeps them; older rows are null = in the closet.
alter table public.wardrobe_items
  add column origin text not null default 'garment_photo' check (origin in ('garment_photo', 'outfit_photo')),
  add column review_state text check (review_state in ('pending', 'kept'));
