-- Fictional lineup only. Stable ids are shared with docs/홍주P_plan.md §10.1.
-- No Auth credentials, user data, or provider secrets belong in this seed.

insert into public.influencers (id, name, type, verified_at) values
  ('20000000-0000-4000-8000-000000000001', '한별 김', 'tour', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000002', '유나 박', 'tour', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000003', '서윤 최', 'tour', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000004', '지우 정', 'tour', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000005', '하린 이', 'tour', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000006', '라운드메이트 서아', 'youtuber', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000007', '스윙로그 도윤', 'youtuber', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000008', '버디샷 민준', 'youtuber', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000009', '골프리포트 은채', 'media_pro', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000010', '페어웨이 뉴스 태오', 'media_pro', '2026-11-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000011', '주말골퍼 선우', 'tour', null)
on conflict (id) do nothing;

insert into public.card_templates (influencer_id, style, image_path)
select i.id, s.style, i.id::text || '/' || s.style::text || '.webp'
from public.influencers i
cross join (values ('illust'::public.card_style), ('retro'::public.card_style), ('holo'::public.card_style)) s(style)
where i.id between '20000000-0000-4000-8000-000000000001'::uuid and '20000000-0000-4000-8000-000000000010'::uuid
on conflict (influencer_id, style) do nothing;

insert into public.chat_rooms (influencer_id)
select i.id from public.influencers i where i.verified_at is not null
on conflict (influencer_id) do nothing;

insert into private.room_settings (room_id)
select r.id from public.chat_rooms r
on conflict (room_id) do nothing;

insert into public.verifications (influencer_id, type, evidence_url, status)
select '20000000-0000-4000-8000-000000000011'::uuid, 'tour', 'https://example.test/evidence/pending-influencer', 'pending'
where not exists (
  select 1 from public.verifications v
  where v.influencer_id = '20000000-0000-4000-8000-000000000011'::uuid and v.status = 'pending'
);

insert into public.game_config (key, value) values
  ('grade_rates', '{"common":70,"rare":20,"epic":7.5,"special":2.5}'::jsonb),
  ('upgrade_cost', '10'::jsonb),
  ('room_entry', '{"min_earned_draws":5}'::jsonb),
  ('priority_weights', '{"own":0.6,"quality":0.4}'::jsonb),
  ('gauge', '{"start":50,"monthly_min_rounds":3,"per_round_delta":12.5,"max":100}'::jsonb)
on conflict (key) do nothing;

insert into private.demo_clock (id, current_month, version)
values ('hackathon', date_trunc('month', clock_timestamp() at time zone 'Asia/Seoul')::date, 1)
on conflict (id) do nothing;

insert into private.runtime_flags (key, value)
values ('demo_force_grade', '{"enabled":false}'::jsonb)
on conflict (key) do nothing;
