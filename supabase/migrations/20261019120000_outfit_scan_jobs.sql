-- Outfit Photo M1: a free "outfit_scan" job finds the garments a person is wearing and stores
-- preview crops; nothing is generated and nothing is charged. Its result jsonb holds the candidates
-- (docs/superpowers/specs/outfit-import-evaluation.md §5). Behind WARDROBE_OUTFIT=on in the API.
-- Existing kinds keep exactly their old rules.

alter table public.generation_jobs
  drop constraint generation_jobs_kind_check,
  add constraint generation_jobs_kind_check check (kind in ('garment', 'back', 'turn', 'outfit_scan'));

-- Was: (kind = 'garment') = (item_id is null). Only back and 360 work on an existing item.
alter table public.generation_jobs
  drop constraint generation_jobs_check1,
  add constraint generation_jobs_item_check check ((kind in ('back', 'turn')) = (item_id is not null));

-- A scan is free to the user: never priced, never holds fronts.
alter table public.generation_jobs
  add constraint generation_jobs_outfit_scan_free check (kind <> 'outfit_scan' or (cost_credits is null and max_items is null));
