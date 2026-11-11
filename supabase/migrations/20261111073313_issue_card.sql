-- 누적 구간 [이전 누적, 이번 누적)에 p_roll이 들어가는 첫 등급을 고른다.
-- 확률 0인 등급은 구간이 비어 뽑히지 않는다. 어느 구간에도 안 들면 설정 오류다.
CREATE FUNCTION private.pick_grade(p_rates jsonb, p_roll numeric)
RETURNS public.card_grade
LANGUAGE plpgsql
-- enum_range가 STABLE이라 IMMUTABLE로 둘 수 없다(db lint).
STABLE
SET search_path = ''
AS $$
DECLARE
  v_grade public.card_grade;
  v_cumulative numeric := 0;
BEGIN
  FOREACH v_grade IN ARRAY enum_range(NULL::public.card_grade) LOOP
    v_cumulative := v_cumulative + coalesce((p_rates ->> v_grade::text)::numeric, 0);
    IF p_roll < v_cumulative THEN
      RETURN v_grade;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001',
    DETAIL = '{"field":"grade_rates","reason":"roll_not_in_any_grade"}';
END;
$$;

CREATE FUNCTION private.pick_index(p_count int, p_roll numeric)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT floor(p_roll * p_count)::int;
$$;

REVOKE ALL ON FUNCTION private.pick_grade(jsonb, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pick_index(int, numeric) FROM PUBLIC, anon, authenticated;

-- complete_round가 자기 트랜잭션 안에서 부른다. EXCEPTION 블록을 두지 않는 것이 불변 조건이다:
-- draws INSERT 뒤의 어떤 실패도 그대로 올라가야 호출자 트랜잭션이 통째로 롤백된다.
-- 같은 round_id 재호출은 draws.round_id UNIQUE(23505), 남의 round는 FK(23503)로 실패한다.
-- 남의 round 차단은 draws(round_id, user_id) -> rounds(id, user_id) 복합 FK에 의존한다(R8). 이 함수는 소유권을 검사하지 않는다.
-- isNew와 entryUnlocked는 호출자(complete_round)가 사용자별 잠금을 쥔 동안에만 정확하다(§3).
CREATE FUNCTION private.issue_card(
  p_user_id uuid,
  p_round_id uuid,
  p_force_grade public.card_grade DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_rates jsonb;
  v_entry jsonb;
  v_min numeric;
  v_template_count int;
  v_roll_grade numeric;
  v_roll_template numeric;
  v_grade public.card_grade;
  v_template public.card_templates;
  v_influencer public.influencers;
  v_is_new boolean;
  v_before int;
  v_draw_id uuid;
  v_owned int;
BEGIN
  -- 1. 설정 검증. jsonb_typeof를 먼저 통과시켜야 아래 numeric 캐스트가 오류를 내지 않는다.
  SELECT value INTO v_rates FROM public.game_config WHERE key = 'grade_rates';
  IF v_rates IS NULL OR jsonb_typeof(v_rates) <> 'object' THEN
    RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '{"key":"grade_rates"}';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(v_rates)) <> 4
     OR EXISTS (
       SELECT 1 FROM jsonb_each(v_rates) e
       WHERE e.key NOT IN ('common', 'rare', 'epic', 'special') OR jsonb_typeof(e.value) <> 'number'
     )
  THEN
    RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '{"key":"grade_rates"}';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(v_rates) e WHERE (e.value #>> '{}')::numeric < 0)
     OR (SELECT sum((e.value #>> '{}')::numeric) FROM jsonb_each(v_rates) e) <> 100
  THEN
    RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '{"key":"grade_rates"}';
  END IF;

  SELECT value INTO v_entry FROM public.game_config WHERE key = 'room_entry';
  IF v_entry IS NULL OR jsonb_typeof(v_entry) <> 'object' THEN
    RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '{"key":"room_entry"}';
  END IF;
  IF jsonb_typeof(v_entry -> 'min_earned_draws') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '{"key":"room_entry"}';
  END IF;
  v_min := (v_entry ->> 'min_earned_draws')::numeric;
  IF v_min <> trunc(v_min) OR v_min <= 0 THEN
    RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '{"key":"room_entry"}';
  END IF;

  SELECT count(*) INTO v_template_count FROM public.card_templates;
  IF v_template_count = 0 THEN
    RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '{"key":"card_templates"}';
  END IF;

  -- 2. 난수 두 개를 따로 만든다. 4바이트 / 2^32 라서 [0, 1)이다.
  v_roll_grade := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint / 4294967296.0;
  v_roll_template := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint / 4294967296.0;

  -- 3. 등급
  v_grade := coalesce(p_force_grade, private.pick_grade(v_rates, v_roll_grade * 100));

  -- 4. 템플릿
  SELECT * INTO v_template FROM public.card_templates
  ORDER BY id
  OFFSET private.pick_index(v_template_count, v_roll_template) LIMIT 1;

  SELECT * INTO v_influencer FROM public.influencers WHERE id = v_template.influencer_id;

  -- 5. isNew: 전 등급 합계 기준
  SELECT coalesce(sum(count), 0) = 0 INTO v_is_new
  FROM public.user_cards
  WHERE user_id = p_user_id AND template_id = v_template.id;

  -- 6. 발급 전 누적: 같은 인플루언서의 draws 건수
  SELECT count(*) INTO v_before
  FROM public.draws d
  JOIN public.card_templates t ON t.id = d.template_id
  WHERE d.user_id = p_user_id AND t.influencer_id = v_template.influencer_id;

  -- 7. 기록
  INSERT INTO public.draws (user_id, round_id, template_id, grade, is_new, forced)
  VALUES (p_user_id, p_round_id, v_template.id, v_grade, v_is_new, p_force_grade IS NOT NULL)
  RETURNING id INTO v_draw_id;

  -- 8. 보유 수량
  INSERT INTO public.user_cards (user_id, template_id, grade, count)
  VALUES (p_user_id, v_template.id, v_grade, 1)
  ON CONFLICT (user_id, template_id, grade)
  DO UPDATE SET count = public.user_cards.count + 1, updated_at = now()
  RETURNING count INTO v_owned;

  -- 9~10.
  RETURN jsonb_build_object(
    'drawId', v_draw_id,
    'grade', v_grade,
    'template', jsonb_build_object(
      'id', v_template.id,
      'influencerId', v_influencer.id,
      'influencerName', v_influencer.name,
      'influencerType', v_influencer.type,
      'verifiedAt', v_influencer.verified_at,
      'style', v_template.style,
      'imagePath', v_template.image_path
    ),
    'isNew', v_is_new,
    'ownedCount', v_owned,
    'entryUnlocked', v_before < v_min AND v_before + 1 >= v_min
  );
END;
$$;

REVOKE ALL ON FUNCTION private.issue_card(uuid, uuid, public.card_grade) FROM PUBLIC, anon, authenticated;

comment on function private.issue_card(uuid,uuid,public.card_grade) is 'A-09 문환P issue_card (migration)';
