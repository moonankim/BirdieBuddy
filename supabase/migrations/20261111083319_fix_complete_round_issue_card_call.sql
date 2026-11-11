-- regprocedure renders the full signature (name and argument types), which is
-- not valid as a function-call expression in dynamic SQL. Keep the dependency
-- check, then resolve the exact typed call from its bound arguments.
CREATE OR REPLACE FUNCTION public.complete_round(
  p_request_id uuid,
  p_force_grade public.card_grade DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_month date;
  v_kind text;
  v_round uuid;
  v_issue jsonb;
  v_result jsonb;
  v_cached jsonb;
  v_force_enabled boolean;
  v_issue_card regprocedure;
BEGIN
  IF v_actor IS NULL THEN PERFORM private.raise_api_error('UNAUTHENTICATED'); END IF;
  IF private.current_role() <> 'user'::public.user_role THEN PERFORM private.raise_api_error('FORBIDDEN'); END IF;
  IF p_request_id IS NULL THEN PERFORM private.raise_api_error('VALIDATION_ERROR'); END IF;
  v_cached := private.reserve_simple_operation(v_actor, 'complete_round', p_request_id,
    private.hash_payload(jsonb_build_object('forceGrade', p_force_grade)));
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;

  PERFORM private.lock_user(v_actor);
  IF private.current_actor_clock_kind() = 'demo' THEN
    SELECT c.current_month INTO v_month FROM private.demo_clock c WHERE c.id = 'hackathon' FOR UPDATE;
    IF v_month IS NULL THEN PERFORM private.raise_api_error('CONFIG_INVALID'); END IF;
    v_kind := 'demo';
  ELSE
    v_month := date_trunc('month', clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date;
    v_kind := 'real';
  END IF;

  IF p_force_grade IS NOT NULL THEN
    SELECT coalesce((f.value ->> 'enabled')::boolean, false) INTO v_force_enabled
    FROM private.runtime_flags f WHERE f.key = 'demo_force_grade';
    IF NOT coalesce(v_force_enabled, false) OR NOT EXISTS (
      SELECT 1 FROM private.demo_accounts d WHERE d.user_id = v_actor AND d.can_force_grade
    ) THEN
      PERFORM private.raise_api_error('FORBIDDEN');
    END IF;
  END IF;

  v_round := gen_random_uuid();
  INSERT INTO public.rounds (id, user_id, period_month, clock_kind)
  VALUES (v_round, v_actor, v_month, v_kind);

  SELECT to_regprocedure('private.issue_card(uuid,uuid,public.card_grade)') INTO v_issue_card;
  IF v_issue_card IS NULL THEN
    PERFORM private.raise_api_error('INTERNAL_ERROR', jsonb_build_object('dependency', 'A-09 private.issue_card'));
  END IF;
  EXECUTE 'SELECT private.issue_card($1,$2,$3)'
    INTO v_issue USING v_actor, v_round, p_force_grade;

  v_result := jsonb_build_object(
    'roundId', v_round,
    'drawId', v_issue -> 'drawId',
    'grade', v_issue -> 'grade',
    'template', v_issue -> 'template',
    'isNew', v_issue -> 'isNew',
    'ownedCount', v_issue -> 'ownedCount',
    'entryUnlocked', v_issue -> 'entryUnlocked'
  );
  PERFORM private.finish_simple_operation(v_actor, 'complete_round', p_request_id, v_result);
  RETURN v_result;
END;
$function$;
