-- Local config.toml creates these buckets during local startup; hosted projects need explicit rows.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('card-assets','card-assets',true,10485760,array['image/png','image/jpeg','image/webp']),
  ('influencer-profiles','influencer-profiles',true,5242880,array['image/webp'])
on conflict(id) do nothing;
