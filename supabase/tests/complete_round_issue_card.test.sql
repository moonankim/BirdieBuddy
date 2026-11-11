BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

CREATE TEMP TABLE complete_round_ctx (
  user_id uuid,
  request_id uuid,
  next_request_id uuid,
  unauthorized_request_id uuid,
  force_request_id uuid,
  rollback_request_id uuid
);
INSERT INTO complete_round_ctx VALUES
  (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
CREATE TEMP TABLE complete_round_result (attempt integer PRIMARY KEY, result jsonb);

DO $$
DECLARE
  v_user uuid;
  v_request uuid;
  v_next_request uuid;
  v_influencer_id uuid;
  v_template_id uuid;
  v_round uuid;
  v_draw_count integer;
BEGIN
  SELECT user_id, request_id, next_request_id
    INTO v_user, v_request, v_next_request FROM complete_round_ctx;
  INSERT INTO auth.users (id, email) VALUES (v_user, v_user || '@complete-round.test');
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  -- Every possible random template belongs to an influencer with four prior draws.
  FOR v_influencer_id IN SELECT DISTINCT influencer_id FROM public.card_templates LOOP
    SELECT id INTO v_template_id FROM public.card_templates
    WHERE influencer_id = v_influencer_id ORDER BY id LIMIT 1;
    FOR i IN 1..4 LOOP
      INSERT INTO public.rounds (user_id, period_month, clock_kind)
      VALUES (v_user, date_trunc('month', clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date, 'real')
      RETURNING id INTO v_round;
      INSERT INTO public.draws (user_id, round_id, template_id, grade, is_new, forced)
      VALUES (v_user, v_round, v_template_id, 'common', true, false);
    END LOOP;
  END LOOP;

  INSERT INTO complete_round_result VALUES (1, public.complete_round(v_request, NULL));
  INSERT INTO complete_round_result VALUES (2, public.complete_round(v_request, NULL));

  -- Bring every influencer to five prior draws so the next random issue cannot unlock again.
  FOR v_influencer_id IN SELECT DISTINCT influencer_id FROM public.card_templates LOOP
    SELECT id INTO v_template_id FROM public.card_templates
    WHERE influencer_id = v_influencer_id ORDER BY id LIMIT 1;
    SELECT count(*)::integer INTO v_draw_count
    FROM public.draws d JOIN public.card_templates t ON t.id = d.template_id
    WHERE d.user_id = v_user AND t.influencer_id = v_influencer_id;
    WHILE v_draw_count < 5 LOOP
      INSERT INTO public.rounds (user_id, period_month, clock_kind)
      VALUES (v_user, date_trunc('month', clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date, 'real')
      RETURNING id INTO v_round;
      INSERT INTO public.draws (user_id, round_id, template_id, grade, is_new, forced)
      VALUES (v_user, v_round, v_template_id, 'common', true, false);
      v_draw_count := v_draw_count + 1;
    END LOOP;
  END LOOP;

  INSERT INTO complete_round_result VALUES (3, public.complete_round(v_next_request, NULL));
END;
$$;

SELECT ok(
  (SELECT result ?& ARRAY['roundId', 'drawId', 'grade', 'template', 'isNew', 'ownedCount', 'entryUnlocked']
   FROM complete_round_result WHERE attempt = 1),
  'complete_round returns the A-09 award contract'
);
SELECT ok(
  (SELECT result ->> 'grade' IN ('common', 'rare', 'epic', 'special')
   FROM complete_round_result WHERE attempt = 1),
  'complete_round returns a valid probability-based grade'
);
SELECT is(
  (SELECT result ->> 'entryUnlocked' FROM complete_round_result WHERE attempt = 1),
  'true',
  'complete_round propagates the 4-to-5 draw unlock'
);
SELECT is(
  (SELECT result ->> 'roundId' FROM complete_round_result WHERE attempt = 2),
  (SELECT result ->> 'roundId' FROM complete_round_result WHERE attempt = 1),
  'retry returns the original round'
);
SELECT is(
  (SELECT result ->> 'drawId' FROM complete_round_result WHERE attempt = 2),
  (SELECT result ->> 'drawId' FROM complete_round_result WHERE attempt = 1),
  'retry returns the original draw'
);
SELECT is(
  (SELECT count(*)::integer FROM public.rounds r
   WHERE r.id = (SELECT (result ->> 'roundId')::uuid FROM complete_round_result WHERE attempt = 1)),
  1,
  'complete_round creates one round'
);
SELECT is(
  (SELECT count(*)::integer FROM public.draws d
   WHERE d.round_id = (SELECT (result ->> 'roundId')::uuid FROM complete_round_result WHERE attempt = 1)
     AND d.user_id = (SELECT user_id FROM complete_round_ctx)),
  1,
  'complete_round creates exactly one draw for the user'
);
SELECT is(
  (SELECT d.id::text FROM public.draws d
   WHERE d.round_id = (SELECT (result ->> 'roundId')::uuid FROM complete_round_result WHERE attempt = 1)),
  (SELECT result ->> 'drawId' FROM complete_round_result WHERE attempt = 1),
  'returned draw ID matches the committed A-09 draw'
);
SELECT is(
  (SELECT result ->> 'entryUnlocked' FROM complete_round_result WHERE attempt = 3),
  'false',
  'complete_round does not unlock again after five draws'
);

CREATE TEMP TABLE no_force_snapshot AS
SELECT count(*)::integer AS draw_count FROM public.draws
WHERE user_id = (SELECT user_id FROM complete_round_ctx);
SELECT throws_ok(
  $$SELECT public.complete_round((SELECT unauthorized_request_id FROM complete_round_ctx), 'epic')$$,
  'P0001', 'FORBIDDEN', 'user without demo capability cannot force a grade'
);
SELECT is(
  (SELECT count(*)::integer FROM public.draws WHERE user_id = (SELECT user_id FROM complete_round_ctx)),
  (SELECT draw_count FROM no_force_snapshot),
  'unauthorized force request creates no draw'
);

INSERT INTO private.demo_clock (id, current_month)
VALUES ('hackathon', date_trunc('month', clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date)
ON CONFLICT (id) DO NOTHING;
INSERT INTO private.demo_accounts (user_id, can_force_grade, can_advance_month)
SELECT user_id, true, false FROM complete_round_ctx
ON CONFLICT (user_id) DO UPDATE SET can_force_grade = true;
INSERT INTO private.runtime_flags (key, value)
VALUES ('demo_force_grade', '{"enabled":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = excluded.value;
INSERT INTO complete_round_result
SELECT 4, public.complete_round(force_request_id, 'epic') FROM complete_round_ctx;

SELECT is(
  (SELECT result ->> 'grade' FROM complete_round_result WHERE attempt = 4),
  'epic',
  'authorized demo force grade is returned'
);
SELECT ok(
  (SELECT d.forced FROM public.draws d
   WHERE d.id = (SELECT (result ->> 'drawId')::uuid FROM complete_round_result WHERE attempt = 4)),
  'authorized forced grade is marked in draws'
);

CREATE TEMP TABLE rollback_snapshot AS
SELECT
  (SELECT count(*)::integer FROM public.rounds
   WHERE user_id = (SELECT user_id FROM complete_round_ctx)) AS rounds,
  (SELECT count(*)::integer FROM public.draws
   WHERE user_id = (SELECT user_id FROM complete_round_ctx)) AS draws;
CREATE FUNCTION pg_temp.fail_complete_round_draw() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'COMPLETE_ROUND_DRAW_FAILURE' USING ERRCODE = 'P0001';
END;
$$;
CREATE TRIGGER test_complete_round_draw_failure
BEFORE INSERT ON public.draws
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_complete_round_draw();
SELECT throws_ok(
  $$SELECT public.complete_round((SELECT rollback_request_id FROM complete_round_ctx), NULL)$$,
  'P0001', 'COMPLETE_ROUND_DRAW_FAILURE', 'issue_card failure propagates through complete_round'
);
SELECT is(
  (SELECT count(*)::integer FROM public.rounds
   WHERE user_id = (SELECT user_id FROM complete_round_ctx)),
  (SELECT rounds FROM rollback_snapshot),
  'failed award rolls back its round'
);
SELECT is(
  (SELECT count(*)::integer FROM public.draws
   WHERE user_id = (SELECT user_id FROM complete_round_ctx)),
  (SELECT draws FROM rollback_snapshot),
  'failed award leaves no draw'
);
SELECT is(
  (SELECT count(*)::integer FROM private.operations
   WHERE actor_id = (SELECT user_id FROM complete_round_ctx)
     AND operation = 'complete_round'
     AND request_id = (SELECT rollback_request_id FROM complete_round_ctx)),
  0,
  'failed award rolls back the idempotency reservation'
);

SELECT * FROM finish();
ROLLBACK;
