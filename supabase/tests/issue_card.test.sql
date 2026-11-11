BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- 등급 경계
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 0), 'common'::public.card_grade, 'roll 0 -> common');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 69.999), 'common'::public.card_grade, 'roll 69.999 -> common');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 70), 'rare'::public.card_grade, 'roll 70 -> rare');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 89.999), 'rare'::public.card_grade, 'roll 89.999 -> rare');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 90), 'epic'::public.card_grade, 'roll 90 -> epic');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 97.499), 'epic'::public.card_grade, 'roll 97.499 -> epic');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 97.5), 'special'::public.card_grade, 'roll 97.5 -> special');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 99.999), 'special'::public.card_grade, 'roll 99.999 -> special');
SELECT isnt(private.pick_grade('{"common":70,"rare":20,"epic":10,"special":0}', 99.999), 'special'::public.card_grade, 'zero-rate special is never picked');
SELECT is(private.pick_grade('{"common":70,"rare":20,"epic":10,"special":0}', 99.999), 'epic'::public.card_grade, 'top roll falls to epic when special is 0');
SELECT throws_ok(
  $$SELECT private.pick_grade('{"common":70,"rare":20,"epic":7.5,"special":2.5}', 100)$$,
  'P0001', 'CONFIG_INVALID', 'roll outside every bucket -> CONFIG_INVALID');

-- 템플릿 경계
SELECT is(private.pick_index(30, 0), 0, 'index 0');
SELECT is(private.pick_index(30, 0.0333), 0, 'index 0.0333 -> 0');
SELECT is(private.pick_index(30, 0.0334), 1, 'index 0.0334 -> 1');
SELECT is(private.pick_index(30, 0.5), 15, 'index 0.5 -> 15');
SELECT is(private.pick_index(30, 0.999999), 29, 'index 0.999999 -> 29');

-- 권한
SELECT is(has_function_privilege('anon', 'private.pick_grade(jsonb,numeric)', 'EXECUTE'), false, 'anon cannot execute pick_grade');
SELECT is(has_function_privilege('authenticated', 'private.pick_grade(jsonb,numeric)', 'EXECUTE'), false, 'authenticated cannot execute pick_grade');
SELECT is(has_function_privilege('anon', 'private.pick_index(integer,numeric)', 'EXECUTE'), false, 'anon cannot execute pick_index');
SELECT is(has_function_privilege('authenticated', 'private.pick_index(integer,numeric)', 'EXECUTE'), false, 'authenticated cannot execute pick_index');


-- issue_card 준비: 템플릿 1개라 pick_index가 항상 0이고, 설정은 기본값으로 되돌린다.
CREATE TEMP TABLE res (k text PRIMARY KEY, j jsonb);

CREATE FUNCTION pg_temp.new_user() RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v, v || '@test.local');
  RETURN v;
END $f$;

CREATE FUNCTION pg_temp.new_round(p_user uuid) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE v uuid;
BEGIN
  INSERT INTO public.rounds (user_id, period_month, clock_kind)
  VALUES (p_user, '2026-11-01', 'real') RETURNING id INTO v;
  RETURN v;
END $f$;

CREATE PROCEDURE pg_temp.setup(p_min int DEFAULT 5) LANGUAGE plpgsql AS $f$
DECLARE v_inf uuid;
BEGIN
  DELETE FROM public.draws;
  DELETE FROM public.user_cards;
  DELETE FROM public.card_templates;
  DELETE FROM public.influencers WHERE name = 'X';
  INSERT INTO public.influencers (name, type) VALUES ('X', 'youtuber') RETURNING id INTO v_inf;
  INSERT INTO public.card_templates (influencer_id, style, image_path) VALUES (v_inf, 'illust', v_inf::text || '/illust.webp');
  INSERT INTO public.game_config (key, value) VALUES
    ('grade_rates', '{"common":70,"rare":20,"epic":7.5,"special":2.5}'),
    ('room_entry', jsonb_build_object('min_earned_draws', p_min))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END $f$;

CREATE FUNCTION pg_temp.seed_draws(p_user uuid, p_n int) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE r uuid;
BEGIN
  FOR i IN 1..p_n LOOP
    r := pg_temp.new_round(p_user);
    INSERT INTO public.draws (user_id, round_id, template_id, grade, is_new)
    SELECT p_user, r, id, 'common', true FROM public.card_templates LIMIT 1;
  END LOOP;
END $f$;

-- 난수
SELECT isnt(extensions.gen_random_bytes(4), NULL, 'gen_random_bytes(4) is available');
SELECT ok(
  (SELECT bool_and(v >= 0 AND v < 1)
   FROM (SELECT ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint / 4294967296.0 AS v
         FROM generate_series(1, 2000)) t),
  'random conversion stays in [0, 1)');
SELECT is(('x' || 'ffffffff')::bit(32)::bigint / 4294967296.0 < 1, true, 'max 4-byte value stays below 1');

-- 강제 발급
CALL pg_temp.setup();
CREATE TEMP TABLE ctx AS SELECT pg_temp.new_user() AS u;
INSERT INTO res SELECT 'force', private.issue_card((SELECT u FROM ctx), pg_temp.new_round((SELECT u FROM ctx)), 'epic');
SELECT is((SELECT j->>'grade' FROM res WHERE k = 'force'), 'epic', 'forced grade is returned');
SELECT is((SELECT forced FROM public.draws WHERE id = ((SELECT j->>'drawId' FROM res WHERE k = 'force'))::uuid), true, 'forced draw has forced=true');
SELECT is((SELECT grade::text FROM public.draws WHERE id = ((SELECT j->>'drawId' FROM res WHERE k = 'force'))::uuid), 'epic', 'draws.grade matches forced grade');
INSERT INTO res SELECT 'free', private.issue_card((SELECT u FROM ctx), pg_temp.new_round((SELECT u FROM ctx)));
SELECT is((SELECT forced FROM public.draws WHERE id = ((SELECT j->>'drawId' FROM res WHERE k = 'free'))::uuid), false, 'unforced draw has forced=false');
SELECT ok((SELECT (j->>'grade')::public.card_grade IS NOT NULL FROM res WHERE k = 'free'), 'unforced grade is an enum value');

-- isNew
CALL pg_temp.setup();
CREATE TEMP TABLE ctx2 AS SELECT pg_temp.new_user() AS u;
INSERT INTO public.user_cards (user_id, template_id, grade, count)
SELECT (SELECT u FROM ctx2), id, 'common', 3 FROM public.card_templates;
INSERT INTO res SELECT 'old', private.issue_card((SELECT u FROM ctx2), pg_temp.new_round((SELECT u FROM ctx2)), 'rare');
SELECT is((SELECT j->>'isNew' FROM res WHERE k = 'old'), 'false', 'owning another grade of the template -> isNew false');
SELECT is((SELECT is_new FROM public.draws WHERE id = ((SELECT j->>'drawId' FROM res WHERE k = 'old'))::uuid), false, 'draws.is_new=false');
SELECT is((SELECT j->>'ownedCount' FROM res WHERE k = 'old'), '1', 'new rare row -> ownedCount 1');

CALL pg_temp.setup();
CREATE TEMP TABLE ctx3 AS SELECT pg_temp.new_user() AS u;
INSERT INTO public.user_cards (user_id, template_id, grade, count)
SELECT (SELECT u FROM ctx3), id, 'common', 0 FROM public.card_templates;
INSERT INTO res SELECT 'zero', private.issue_card((SELECT u FROM ctx3), pg_temp.new_round((SELECT u FROM ctx3)));
SELECT is((SELECT j->>'isNew' FROM res WHERE k = 'zero'), 'true', 'only count-0 rows -> isNew true');

CALL pg_temp.setup();
CREATE TEMP TABLE ctx4 AS SELECT pg_temp.new_user() AS u;
INSERT INTO public.user_cards (user_id, template_id, grade, count)
SELECT (SELECT u FROM ctx4), id, 'rare', 2 FROM public.card_templates;
INSERT INTO res SELECT 'inc', private.issue_card((SELECT u FROM ctx4), pg_temp.new_round((SELECT u FROM ctx4)), 'rare');
SELECT is((SELECT j->>'ownedCount' FROM res WHERE k = 'inc'), '3', 'rare 2 + rare draw -> ownedCount 3');

-- entryUnlocked
CALL pg_temp.setup();
CREATE TEMP TABLE ctx5 AS SELECT pg_temp.new_user() AS u;
SELECT pg_temp.seed_draws((SELECT u FROM ctx5), 4);
INSERT INTO res SELECT 'e1', private.issue_card((SELECT u FROM ctx5), pg_temp.new_round((SELECT u FROM ctx5)));
INSERT INTO res SELECT 'e2', private.issue_card((SELECT u FROM ctx5), pg_temp.new_round((SELECT u FROM ctx5)));
SELECT is((SELECT j->>'entryUnlocked' FROM res WHERE k = 'e1'), 'true', '4 -> 5 unlocks');
SELECT is((SELECT j->>'entryUnlocked' FROM res WHERE k = 'e2'), 'false', '5 -> 6 does not unlock again');

CALL pg_temp.setup(3);
CREATE TEMP TABLE ctx6 AS SELECT pg_temp.new_user() AS u;
SELECT pg_temp.seed_draws((SELECT u FROM ctx6), 2);
INSERT INTO res SELECT 'e3', private.issue_card((SELECT u FROM ctx6), pg_temp.new_round((SELECT u FROM ctx6)));
SELECT is((SELECT j->>'entryUnlocked' FROM res WHERE k = 'e3'), 'true', 'min_earned_draws=3, 2 -> 3 unlocks');

CALL pg_temp.setup(1);
CREATE TEMP TABLE ctx7 AS SELECT pg_temp.new_user() AS u;
INSERT INTO public.user_cards (user_id, template_id, grade, count)
SELECT (SELECT u FROM ctx7), id, 'common', 10 FROM public.card_templates;
INSERT INTO res SELECT 'e4', private.issue_card((SELECT u FROM ctx7), pg_temp.new_round((SELECT u FROM ctx7)));
SELECT is((SELECT j->>'entryUnlocked' FROM res WHERE k = 'e4'), 'true', 'user_cards are not counted, only draws');

-- 범위 조건: 인플루언서 X, Y에 템플릿 1개씩. 사용자는 Y 템플릿에만 draws 4건과 보유 카드가 있다.
-- 템플릿을 무작위로 고르므로 10명을 돌려 X와 Y가 모두 나올 확률을 높인다(올바른 구현은 항상 통과).
CALL pg_temp.setup(5);
CREATE TEMP TABLE f1 (u uuid, j jsonb);
DO $f$
DECLARE
  v_y uuid;
  v_ty uuid;
  v_u uuid;
  r uuid;
BEGIN
  INSERT INTO public.influencers (name, type) VALUES ('Y', 'youtuber') RETURNING id INTO v_y;
  INSERT INTO public.card_templates (influencer_id, style, image_path) VALUES (v_y, 'illust', v_y::text || '/illust.webp') RETURNING id INTO v_ty;
  FOR n IN 1..10 LOOP
    v_u := pg_temp.new_user();
    FOR i IN 1..4 LOOP
      r := pg_temp.new_round(v_u);
      INSERT INTO public.draws (user_id, round_id, template_id, grade, is_new) VALUES (v_u, r, v_ty, 'common', true);
    END LOOP;
    INSERT INTO public.user_cards (user_id, template_id, grade, count) VALUES (v_u, v_ty, 'common', 4);
    INSERT INTO f1 VALUES (v_u, private.issue_card(v_u, pg_temp.new_round(v_u)));
  END LOOP;
END $f$;
SELECT ok(
  (SELECT bool_and((j->'template'->>'influencerId' = (SELECT id::text FROM public.influencers WHERE name = 'Y')) = (j->>'entryUnlocked')::boolean) FROM f1),
  'entryUnlocked counts only draws of the same influencer');
SELECT ok(
  (SELECT bool_and((j->'template'->>'id' <> (SELECT t.id::text FROM public.card_templates t JOIN public.influencers i ON i.id = t.influencer_id WHERE i.name = 'Y')) = (j->>'isNew')::boolean) FROM f1),
  'isNew considers only the drawn template');

-- 설정 오류
CALL pg_temp.setup();
CREATE TEMP TABLE ctx8 AS SELECT pg_temp.new_user() AS u;
CREATE TEMP TABLE r8 AS SELECT pg_temp.new_round((SELECT u FROM ctx8)) AS r;

DELETE FROM public.game_config WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'grade_rates row missing');

CALL pg_temp.setup();
UPDATE public.game_config SET value = '{"common":70,"epic":20,"special":10}' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'rare key missing');

UPDATE public.game_config SET value = '{"common":70,"rare":21,"epic":-1,"special":10}' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'negative rate with sum 100');

UPDATE public.game_config SET value = '{"common":70,"rare":20,"epic":7.5,"special":1.5}' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'sum 99');

UPDATE public.game_config SET value = '{"common":70,"rare":"20","epic":7.5,"special":2.5}' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'string rate');

UPDATE public.game_config SET value = '{"common":70,"rare":null,"epic":20,"special":10}' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'null rate');

UPDATE public.game_config SET value = '{"common":70,"rare":20,"epic":7.5,"special":2.5,"mythic":0}' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'fifth key');

UPDATE public.game_config SET value = '{"common":70,"rare":20,"epic":7.5,"mythic":2.5}' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'unknown key replacing special');

UPDATE public.game_config SET value = '[70,20,7.5,2.5]' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'grade_rates is an array');

UPDATE public.game_config SET value = '5' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'grade_rates is a scalar number');

UPDATE public.game_config SET value = '"x"' WHERE key = 'grade_rates';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'grade_rates is a string');

CALL pg_temp.setup();
DELETE FROM public.game_config WHERE key = 'room_entry';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'room_entry row missing');

CALL pg_temp.setup();
UPDATE public.game_config SET value = '{"min_earned_draws":0}' WHERE key = 'room_entry';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'min_earned_draws 0');
UPDATE public.game_config SET value = '{"min_earned_draws":-1}' WHERE key = 'room_entry';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'min_earned_draws -1');
UPDATE public.game_config SET value = '{"min_earned_draws":2.5}' WHERE key = 'room_entry';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'min_earned_draws 2.5');
UPDATE public.game_config SET value = '{"min_earned_draws":"5"}' WHERE key = 'room_entry';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'min_earned_draws string');
UPDATE public.game_config SET value = '{}' WHERE key = 'room_entry';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'min_earned_draws missing');
UPDATE public.game_config SET value = '5' WHERE key = 'room_entry';
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'room_entry is not an object');

CALL pg_temp.setup();
DELETE FROM public.card_templates;
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, 'P0001', 'CONFIG_INVALID', 'zero templates');

CALL pg_temp.setup();
SELECT is((SELECT count(*)::int FROM public.draws WHERE user_id = (SELECT u FROM ctx8)), 0, 'config failures left no draws');
SELECT lives_ok($$SELECT private.issue_card((SELECT u FROM ctx8), (SELECT r FROM r8))$$, '70/20/7.5/2.5 with decimals passes');

-- 원자성
CALL pg_temp.setup();
CREATE TEMP TABLE ctx9 AS SELECT pg_temp.new_user() AS u;
CREATE TEMP TABLE r9 AS SELECT pg_temp.new_round((SELECT u FROM ctx9)) AS r;
CREATE FUNCTION pg_temp.boom() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'BOOM'; END $f$;
CREATE TEMP TABLE cnt AS SELECT (SELECT count(*) FROM public.draws) AS d, (SELECT count(*) FROM public.user_cards) AS c;
CREATE TRIGGER boom BEFORE INSERT OR UPDATE ON public.user_cards FOR EACH ROW EXECUTE FUNCTION pg_temp.boom();
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx9), (SELECT r FROM r9))$$, 'BOOM', 'failure after draws INSERT propagates');
SELECT is((SELECT count(*) FROM public.draws), (SELECT d FROM cnt), 'draws unchanged after user_cards failure');
SELECT is((SELECT count(*) FROM public.user_cards), (SELECT c FROM cnt), 'user_cards unchanged after user_cards failure');
DROP TRIGGER boom ON public.user_cards;

INSERT INTO res SELECT 'first', private.issue_card((SELECT u FROM ctx9), (SELECT r FROM r9));
UPDATE cnt SET d = (SELECT count(*) FROM public.draws), c = (SELECT count(*) FROM public.user_cards);
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx9), (SELECT r FROM r9))$$, '23505', NULL, 'same round_id twice fails');
SELECT is((SELECT count(*) FROM public.draws), (SELECT d FROM cnt), 'draws same as after first call');
SELECT is((SELECT sum(count) FROM public.user_cards WHERE user_id = (SELECT u FROM ctx9)), 1::bigint, 'user_cards count not incremented twice');

CREATE TEMP TABLE ctx10 AS SELECT pg_temp.new_user() AS u;
UPDATE cnt SET d = (SELECT count(*) FROM public.draws), c = (SELECT count(*) FROM public.user_cards);
SELECT throws_ok($$SELECT private.issue_card((SELECT u FROM ctx10), pg_temp.new_round((SELECT u FROM ctx9)))$$, '23503', NULL, 'another user''s round fails');
SELECT is((SELECT count(*) FROM public.draws), (SELECT d FROM cnt), 'draws unchanged after foreign round');
SELECT is((SELECT count(*) FROM public.user_cards), (SELECT c FROM cnt), 'user_cards unchanged after foreign round');

-- 반환 형태
SELECT ok((SELECT j ?& ARRAY['drawId','grade','template','isNew','ownedCount','entryUnlocked'] FROM res WHERE k = 'first'), 'top-level keys present');
SELECT ok((SELECT (j->'template') ?& ARRAY['id','influencerId','influencerName','influencerType','verifiedAt','style','imagePath'] FROM res WHERE k = 'first'), 'template keys present');
SELECT is((SELECT jsonb_object_keys_count FROM (SELECT count(*)::int AS jsonb_object_keys_count FROM res, jsonb_object_keys(j) WHERE k = 'first') t), 6, 'exactly 6 top-level keys');
SELECT is((SELECT j->'template'->>'imagePath' FROM res WHERE k = 'first'), (SELECT image_path FROM public.card_templates LIMIT 1), 'imagePath is image_path as stored');
SELECT is((SELECT j->'template'->>'influencerName' FROM res WHERE k = 'first'), 'X', 'influencerName from influencers');

-- 권한
SELECT is(has_function_privilege('anon', 'private.issue_card(uuid,uuid,card_grade)', 'EXECUTE'), false, 'anon cannot execute issue_card');
SELECT is(has_function_privilege('authenticated', 'private.issue_card(uuid,uuid,card_grade)', 'EXECUTE'), false, 'authenticated cannot execute issue_card');
SELECT is(has_function_privilege('public', 'private.issue_card(uuid,uuid,card_grade)', 'EXECUTE'), false, 'PUBLIC cannot execute issue_card');

SELECT * FROM finish();
ROLLBACK;
