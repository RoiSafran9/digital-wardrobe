-- Multi-user M2: private bucket for original photos, generated catalog images, cutouts, backs and 360 views.
-- Keys: <user_id>/jobs/<job_id>/... (uploads) and <user_id>/items/<item_id>/... (results).
-- The app reads its own files through short-lived signed URLs; only the backend (service_role) writes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 26214400,
        array['image/png', 'image/jpeg', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read files in their own wardrobe folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text);
