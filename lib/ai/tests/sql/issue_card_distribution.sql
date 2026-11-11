-- A-09 1,000회 분포. 트랜잭션 안에서 issue_card를 1,000번 부르고 롤백한다.
-- supabase test db의 대상이 아니다(우연히 3σ 범위를 벗어날 수 있다).
BEGIN;

-- 템플릿이 비어 있을 때만 인플루언서 10명 x 스타일 3종을 만든다.
INSERT INTO public.influencers (name, type)
SELECT 'dist_inf_' || n, (ARRAY['youtuber', 'media_pro', 'tour'])[1 + n % 3]::public.influencer_type
FROM generate_series(1, 10) n
WHERE NOT EXISTS (SELECT 1 FROM public.card_templates);

INSERT INTO public.card_templates (influencer_id, style, image_path)
SELECT i.id, s, 'dist/' || i.id || '/' || s
FROM public.influencers i
CROSS JOIN unnest(enum_range(NULL::public.card_style)) s
WHERE i.name LIKE 'dist\_inf\_%'
  AND NOT EXISTS (SELECT 1 FROM public.card_templates);

INSERT INTO public.game_config (key, value) VALUES
  ('grade_rates', '{"common":70,"rare":20,"epic":7.5,"special":2.5}'),
  ('room_entry', '{"min_earned_draws":5}')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

CREATE TEMP TABLE dist_result (grade text, template_id uuid);

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_round uuid;
  v_res jsonb;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'dist-' || v_user || '@example.test');
  FOR i IN 1..1000 LOOP
    INSERT INTO public.rounds (user_id, period_month, clock_kind)
    VALUES (v_user, date_trunc('month', now())::date, 'real')
    RETURNING id INTO v_round;
    v_res := private.issue_card(v_user, v_round);
    INSERT INTO dist_result (grade, template_id)
    VALUES (v_res ->> 'grade', (v_res -> 'template' ->> 'id')::uuid);
  END LOOP;
END;
$$;

SELECT g.grade, coalesce(c.n, 0) AS n, g.lo, g.hi,
       CASE WHEN coalesce(c.n, 0) BETWEEN g.lo AND g.hi THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM (VALUES ('common', 657, 743), ('rare', 163, 237), ('epic', 51, 99), ('special', 11, 39)) g(grade, lo, hi)
LEFT JOIN (SELECT grade, count(*) n FROM dist_result GROUP BY grade) c USING (grade)
ORDER BY g.lo DESC;

WITH per AS (
  SELECT t.id, count(r.template_id) n
  FROM public.card_templates t LEFT JOIN dist_result r ON r.template_id = t.id
  GROUP BY t.id
)
SELECT min(n) AS template_min, max(n) AS template_max, count(*) AS template_kinds, sum(n) AS total FROM per;

SELECT count(*) FILTER (WHERE forced) AS forced_true_count, count(*) AS draws_total
FROM public.draws WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'dist-%@example.test');

ROLLBACK;
