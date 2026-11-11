create or replace function private.raise_api_error(p_code text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_details, '{}'::jsonb)::text;
end;
$function$;

create or replace function private.hash_payload(p_payload jsonb)
returns text
language sql
immutable
strict
set search_path = ''
as $function$
  select encode(extensions.digest(p_payload::text, 'sha256'), 'hex')
$function$;

create or replace function private.reserve_simple_operation(
  p_actor_id uuid,
  p_operation text,
  p_request_id uuid,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation private.operations%rowtype;
begin
  if p_actor_id is null or p_request_id is null or p_operation is null or p_payload_hash is null then
    perform private.raise_api_error('VALIDATION_ERROR');
  end if;

  insert into private.operations (actor_id, operation, request_id, payload_hash, state)
  values (p_actor_id, p_operation, p_request_id, p_payload_hash, 'processing')
  on conflict (actor_id, operation, request_id) do nothing;

  select * into v_operation
  from private.operations o
  where o.actor_id = p_actor_id and o.operation = p_operation and o.request_id = p_request_id
  for update;

  if v_operation.payload_hash <> p_payload_hash then
    perform private.raise_api_error('IDEMPOTENCY_CONFLICT');
  end if;
  if v_operation.state = 'succeeded' then
    return coalesce(v_operation.result, '{}'::jsonb);
  end if;
  if v_operation.state = 'processing' and v_operation.lease_until is not null
      and v_operation.lease_until > clock_timestamp() then
    perform private.raise_api_error('REQUEST_IN_PROGRESS', jsonb_build_object(
      'retryAfterMs', greatest(100, ceil(extract(epoch from (v_operation.lease_until - clock_timestamp())) * 1000)::integer)
    ));
  end if;

  update private.operations o
  set state = 'processing', result = null, lease_token = null, lease_until = null, updated_at = clock_timestamp()
  where o.actor_id = p_actor_id and o.operation = p_operation and o.request_id = p_request_id;
  return null;
end;
$function$;

create or replace function private.finish_simple_operation(
  p_actor_id uuid,
  p_operation text,
  p_request_id uuid,
  p_result jsonb
)
returns void
language sql
security definer
set search_path = ''
as $function$
  update private.operations o
  set state = 'succeeded', result = p_result, lease_token = null, lease_until = null, updated_at = clock_timestamp()
  where o.actor_id = p_actor_id and o.operation = p_operation and o.request_id = p_request_id
$function$;

create or replace function private.next_room_write_time(p_room_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_time timestamptz;
begin
  insert into private.room_settings (room_id) values (p_room_id) on conflict (room_id) do nothing;
  update private.room_settings s
  set last_write_at = greatest(clock_timestamp(), s.last_write_at + interval '1 microsecond')
  where s.room_id = p_room_id
  returning s.last_write_at into v_time;
  return v_time;
end;
$function$;

create or replace function private.lock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $function$
  select pg_advisory_xact_lock(hashtextextended('birdiebuddy:user:' || p_user_id::text, 0))
$function$;

create or replace function private.lock_room(p_room_id uuid)
returns void
language sql
security definer
set search_path = ''
as $function$
  select pg_advisory_xact_lock(hashtextextended('birdiebuddy:room:' || p_room_id::text, 0))
$function$;

create or replace function private.current_actor_clock_kind()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case when exists (select 1 from private.demo_accounts d where d.user_id = auth.uid()) then 'demo' else 'real' end
$function$;

create or replace view public.collection_view with (security_invoker = true) as
select
  t.id as template_id,
  t.influencer_id,
  i.name as influencer_name,
  i.type as influencer_type,
  i.verified_at,
  t.style,
  t.image_path,
  coalesce(sum(uc.count) filter (where uc.grade = 'common'), 0)::integer as common_count,
  coalesce(sum(uc.count) filter (where uc.grade = 'rare'), 0)::integer as rare_count,
  coalesce(sum(uc.count) filter (where uc.grade = 'epic'), 0)::integer as epic_count,
  coalesce(sum(uc.count) filter (where uc.grade = 'special'), 0)::integer as special_count,
  coalesce(sum(uc.count), 0)::integer as total_cards,
  (array_agg(uc.grade order by case uc.grade when 'special' then 4 when 'epic' then 3 when 'rare' then 2 when 'common' then 1 else 0 end desc)
    filter (where uc.count > 0))[1] as highest_grade
from public.card_templates t
join public.influencers i on i.id = t.influencer_id
left join public.user_cards uc on uc.template_id = t.id and uc.user_id = auth.uid()
group by t.id, t.influencer_id, i.name, i.type, i.verified_at, t.style, t.image_path;

create or replace view public.inventory_view with (security_invoker = true) as
select
  t.id as template_id,
  t.influencer_id,
  i.name as influencer_name,
  i.type as influencer_type,
  i.verified_at,
  t.style,
  t.image_path,
  uc.grade,
  uc.count
from public.user_cards uc
join public.card_templates t on t.id = uc.template_id
join public.influencers i on i.id = t.influencer_id
where uc.user_id = auth.uid() and uc.count > 0;

create or replace view public.room_catalog with (security_invoker = true) as
with actor as (
  select auth.uid() as user_id,
    private.current_month_for_actor() as current_month,
    private.current_actor_clock_kind() as clock_kind
), card_totals as (
  select t.influencer_id, count(d.id)::integer as earned_cards
  from public.draws d join public.card_templates t on t.id = d.template_id
  where d.user_id = auth.uid()
  group by t.influencer_id
), owned as (
  select t.influencer_id,
    max(case uc.grade when 'special' then 4 when 'epic' then 3 when 'rare' then 2 when 'common' then 1 else 0 end) filter (where uc.count > 0) as highest_grade_rank,
    count(distinct t.style) filter (where uc.count > 0)::integer as style_count
  from public.user_cards uc join public.card_templates t on t.id = uc.template_id
  where uc.user_id = auth.uid()
  group by t.influencer_id
), month_rounds as (
  select r.period_month, count(*)::integer as round_count
  from public.rounds r, actor a
  where r.user_id = a.user_id and r.period_month = a.current_month and r.clock_kind = a.clock_kind
  group by r.period_month
), entry_config as (
  select (g.value ->> 'min_earned_draws')::integer as required_cards
  from public.game_config g where g.key = 'room_entry'
)
select
  r.id as room_id,
  i.id as influencer_id,
  i.name as influencer_name,
  i.type as influencer_type,
  i.verified_at,
  i.profile_image_path,
  illust.image_path as fallback_image_path,
  coalesce(ec.required_cards, 5) as required_cards,
  coalesce(ct.earned_cards, 0) as earned_cards,
  greatest(coalesce(ec.required_cards, 5) - coalesce(ct.earned_cards, 0), 0) as missing_cards,
  case
    when coalesce(ct.earned_cards, 0) >= 15 and coalesce(o.highest_grade_rank, 0) = 4 then 'albatross'
    when coalesce(ct.earned_cards, 0) >= 15 or coalesce(o.highest_grade_rank, 0) = 4 then 'eagle'
    when coalesce(ct.earned_cards, 0) >= 10 or coalesce(o.highest_grade_rank, 0) >= 3 then 'buddy'
    else 'none'
  end as support_badge,
  case when exists (select 1 from public.card_templates t where t.influencer_id = i.id) then 'ready' else 'preparing' end as card_status,
  coalesce(mr.round_count, 0) as current_month_round_count,
  case when rm.status = 'left' and a.current_month >= rm.left_month
    then greatest(3 - coalesce(mr.round_count, 0), 0) else 0 end as required_rounds_to_rejoin,
  to_jsonb(rm) as membership,
  coalesce(rm.status = 'active', false) as is_active,
  (coalesce(ct.earned_cards, 0) >= coalesce(ec.required_cards, 5)) as has_entry_cards,
  (case when exists (select 1 from public.card_templates t where t.influencer_id = i.id) then true else false end) as has_card_templates,
  coalesce(rm.left_month, date '0001-01-01') as left_month,
  a.current_month,
  (
    coalesce(ct.earned_cards, 0) >= coalesce(ec.required_cards, 5)
    and coalesce(rm.status, 'left') <> 'active'
    and exists (select 1 from public.card_templates t where t.influencer_id = i.id)
    and (rm.status is distinct from 'left' or (a.current_month >= rm.left_month and coalesce(mr.round_count, 0) >= 3))
  ) as can_join,
  case
    when rm.status = 'active' then 'already_active'
    when not exists (select 1 from public.card_templates t where t.influencer_id = i.id) then 'card_preparing'
    when coalesce(ct.earned_cards, 0) < coalesce(ec.required_cards, 5) then 'need_cards'
    when rm.status = 'left' and (a.current_month < rm.left_month or coalesce(mr.round_count, 0) < 3) then 'rejoin_rounds_needed'
    else 'eligible'
  end as join_reason
from public.chat_rooms r
join public.influencers i on i.id = r.influencer_id and i.verified_at is not null
cross join actor a
left join card_totals ct on ct.influencer_id = i.id
left join owned o on o.influencer_id = i.id
left join month_rounds mr on mr.period_month = a.current_month
left join entry_config ec on true
left join public.room_members rm on rm.room_id = r.id and rm.user_id = a.user_id
left join public.card_templates illust on illust.influencer_id = i.id and illust.style = 'illust';

grant select on public.collection_view, public.inventory_view, public.room_catalog to authenticated;

create or replace function public.get_my_round_gauge_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_month date;
  v_kind text;
  v_target integer;
  v_count integer;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role() <> 'user'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  v_month := private.current_month_for_actor();
  v_kind := private.current_actor_clock_kind();
  select (g.value ->> 'monthly_min_rounds')::integer into v_target
  from public.game_config g where g.key = 'gauge';
  if v_target is null or v_target < 0 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  select count(*)::integer into v_count from public.rounds r
  where r.user_id = v_actor and r.clock_kind = v_kind and r.period_month = v_month;
  return jsonb_build_object('currentMonth', v_month, 'monthlyRoundCount', v_count,
    'targetRounds', v_target, 'remainingRounds', greatest(0, v_target - v_count));
end;
$function$;

create or replace function public.complete_round(p_request_id uuid, p_force_grade public.card_grade default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_month date;
  v_kind text;
  v_round uuid;
  v_issue jsonb;
  v_result jsonb;
  v_cached jsonb;
  v_force_enabled boolean;
  v_issue_card regprocedure;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role() <> 'user'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_request_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  v_cached := private.reserve_simple_operation(v_actor, 'complete_round', p_request_id,
    private.hash_payload(jsonb_build_object('forceGrade', p_force_grade)));
  if v_cached is not null then return v_cached; end if;

  perform private.lock_user(v_actor);
  if private.current_actor_clock_kind() = 'demo' then
    select c.current_month into v_month from private.demo_clock c where c.id = 'hackathon' for update;
    if v_month is null then perform private.raise_api_error('CONFIG_INVALID'); end if;
    v_kind := 'demo';
  else
    v_month := date_trunc('month', clock_timestamp() at time zone 'Asia/Seoul')::date;
    v_kind := 'real';
  end if;

  if p_force_grade is not null then
    select coalesce((f.value ->> 'enabled')::boolean, false) into v_force_enabled
    from private.runtime_flags f where f.key = 'demo_force_grade';
    if not coalesce(v_force_enabled, false) or not exists (
      select 1 from private.demo_accounts d where d.user_id = v_actor and d.can_force_grade
    ) then
      perform private.raise_api_error('FORBIDDEN');
    end if;
  end if;

  v_round := gen_random_uuid();
  insert into public.rounds (id, user_id, period_month, clock_kind)
  values (v_round, v_actor, v_month, v_kind);

  select to_regprocedure('private.issue_card(uuid,uuid,public.card_grade)') into v_issue_card;
  if v_issue_card is null then
    perform private.raise_api_error('INTERNAL_ERROR', jsonb_build_object('dependency', 'A-09 private.issue_card'));
  end if;
  execute format('select %s($1,$2,$3)',v_issue_card)
    into v_issue using v_actor,v_round,p_force_grade;

  v_result := jsonb_build_object(
    'roundId', v_round,
    'drawId', v_issue -> 'drawId',
    'grade', v_issue -> 'grade',
    'template', v_issue -> 'template',
    'isNew', v_issue -> 'isNew',
    'ownedCount', v_issue -> 'ownedCount',
    'entryUnlocked', v_issue -> 'entryUnlocked'
  );
  perform private.finish_simple_operation(v_actor, 'complete_round', p_request_id, v_result);
  return v_result;
end;
$function$;

create or replace function public.upgrade_card(
  p_request_id uuid,
  p_template_id uuid,
  p_grade public.card_grade
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_cost integer;
  v_to_grade public.card_grade;
  v_count integer;
  v_remaining integer;
  v_result jsonb;
  v_cached jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role() <> 'user'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_request_id is null or p_template_id is null or p_grade is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if p_grade = 'special' then perform private.raise_api_error('MAX_GRADE'); end if;
  v_cached := private.reserve_simple_operation(v_actor, 'upgrade_card', p_request_id,
    private.hash_payload(jsonb_build_object('templateId', p_template_id, 'grade', p_grade)));
  if v_cached is not null then return v_cached; end if;
  perform private.lock_user(v_actor);

  select (g.value #>> '{}')::integer into v_cost from public.game_config g where g.key = 'upgrade_cost';
  if v_cost is null or v_cost <= 0 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  if not exists (select 1 from public.card_templates t where t.id = p_template_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  v_to_grade := case p_grade when 'common' then 'rare'::public.card_grade when 'rare' then 'epic'::public.card_grade else 'special'::public.card_grade end;
  select uc.count into v_count from public.user_cards uc
  where uc.user_id = v_actor and uc.template_id = p_template_id and uc.grade = p_grade
  for update;
  if coalesce(v_count, 0) < v_cost then
    perform private.raise_api_error('INSUFFICIENT_CARDS', jsonb_build_object('requiredCards', v_cost, 'ownedCards', coalesce(v_count, 0)));
  end if;

  update public.user_cards uc set count = uc.count - v_cost, updated_at = clock_timestamp()
  where uc.user_id = v_actor and uc.template_id = p_template_id and uc.grade = p_grade
  returning uc.count into v_remaining;
  insert into public.user_cards (user_id, template_id, grade, count, updated_at)
  values (v_actor, p_template_id, v_to_grade, 1, clock_timestamp())
  on conflict (user_id, template_id, grade) do update
    set count = public.user_cards.count + 1, updated_at = clock_timestamp()
  returning count into v_count;

  v_result := jsonb_build_object('templateId', p_template_id, 'fromGrade', p_grade, 'toGrade', v_to_grade,
    'consumed', v_cost, 'remainingCount', v_remaining, 'upgradedCount', v_count);
  perform private.finish_simple_operation(v_actor, 'upgrade_card', p_request_id, v_result);
  return v_result;
end;
$function$;

create or replace function public.join_room(p_request_id uuid, p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_month date;
  v_kind text;
  v_required integer;
  v_earned integer;
  v_round_count integer;
  v_gauge numeric(5,1);
  v_member public.room_members%rowtype;
  v_time timestamptz;
  v_result jsonb;
  v_cached jsonb;
  v_has_member boolean;
  v_welcome jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role() <> 'user'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_request_id is null or p_room_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  v_cached := private.reserve_simple_operation(v_actor, 'join_room', p_request_id,
    private.hash_payload(jsonb_build_object('roomId', p_room_id)));
  if v_cached is not null then return v_cached; end if;
  perform private.lock_user(v_actor);

  v_kind := private.current_actor_clock_kind();
  if v_kind = 'demo' then
    select c.current_month into v_month from private.demo_clock c where c.id = 'hackathon' for update;
  else
    v_month := date_trunc('month', clock_timestamp() at time zone 'Asia/Seoul')::date;
  end if;
  if v_month is null then perform private.raise_api_error('CONFIG_INVALID'); end if;
  select (g.value ->> 'min_earned_draws')::integer into v_required from public.game_config g where g.key = 'room_entry';
  select count(d.id)::integer into v_earned
  from public.draws d join public.card_templates t on t.id = d.template_id
  join public.chat_rooms r on r.influencer_id = t.influencer_id
  where d.user_id = v_actor and r.id = p_room_id;
  if v_required is null or v_required <= 0 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  if v_earned < v_required then
    perform private.raise_api_error('INSUFFICIENT_CARDS', jsonb_build_object(
      'requiredCards', v_required, 'earnedCards', v_earned, 'missingCards', v_required - v_earned
    ));
  end if;
  if not exists (select 1 from public.chat_rooms r join public.influencers i on i.id = r.influencer_id
      where r.id = p_room_id and i.verified_at is not null) then perform private.raise_api_error('NOT_FOUND'); end if;
  if not exists (select 1 from public.card_templates t join public.chat_rooms r on r.influencer_id = t.influencer_id where r.id = p_room_id) then
    perform private.raise_api_error('VALIDATION_ERROR', jsonb_build_object('reason', 'card_preparing'));
  end if;

  select * into v_member from public.room_members rm
  where rm.room_id = p_room_id and rm.user_id = v_actor for update;
  v_has_member := found;
  if v_has_member and v_member.status = 'active' then
    v_result := jsonb_build_object('membership', jsonb_build_object(
      'roomId', v_member.room_id, 'status', v_member.status, 'gauge', v_member.gauge,
      'joinedAt', v_member.joined_at, 'joinedMonth', v_member.joined_month,
      'leftAt', v_member.left_at, 'leftMonth', v_member.left_month),
      'alreadyActive', true, 'welcomeMessage', null);
    perform private.finish_simple_operation(v_actor, 'join_room', p_request_id, v_result);
    return v_result;
  end if;

  if v_has_member and v_member.status = 'left' then
    select count(*)::integer into v_round_count from public.rounds r
    where r.user_id = v_actor and r.clock_kind = v_kind and r.period_month = v_month;
    if v_month < v_member.left_month or v_round_count < 3 then
      perform private.raise_api_error('REJOIN_NOT_AVAILABLE', jsonb_build_object(
        'requiredRoundsThisMonth', 3, 'monthlyRoundCount', v_round_count, 'currentMonth', v_month, 'leftMonth', v_member.left_month
      ));
    end if;
  end if;

  select (g.value ->> 'start')::numeric into v_gauge from public.game_config g where g.key = 'gauge';
  if v_gauge is null or v_gauge <= 0 or v_gauge > 100 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  perform private.lock_room(p_room_id);
  v_time := private.next_room_write_time(p_room_id);

  if v_has_member then
    update public.room_members rm set status = 'active', gauge = v_gauge,
      joined_at = v_time, joined_month = v_month, left_at = null, left_month = null, updated_at = v_time
    where rm.room_id = p_room_id and rm.user_id = v_actor
    returning * into v_member;
  else
    insert into public.room_members (room_id, user_id, gauge, status, joined_at, joined_month, updated_at)
    values (p_room_id, v_actor, v_gauge, 'active', v_time, v_month, v_time)
    returning * into v_member;
  end if;
  insert into private.room_member_periods (room_id, user_id, joined_at)
  values (p_room_id, v_actor, v_time);

  select private.message_json(m.id, v_actor) into v_welcome
  from public.messages m
  where m.room_id = p_room_id and m.recipient_user_id = v_actor and m.message_kind = 'greeting';

  v_result := jsonb_build_object('membership', jsonb_build_object(
    'roomId', v_member.room_id, 'status', v_member.status, 'gauge', v_member.gauge,
    'joinedAt', v_member.joined_at, 'joinedMonth', v_member.joined_month,
    'leftAt', v_member.left_at, 'leftMonth', v_member.left_month),
    'alreadyActive', false, 'welcomeMessage', v_welcome);
  perform private.finish_simple_operation(v_actor, 'join_room', p_request_id, v_result);
  return v_result;
end;
$function$;

create or replace function public.advance_demo_month(p_request_id uuid, p_target_month date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_current date;
  v_closed date;
  v_target_rounds integer;
  v_delta numeric;
  v_max numeric;
  v_members jsonb := '[]'::jsonb;
  v_member record;
  v_count integer;
  v_previous numeric(5,1);
  v_gauge numeric(5,1);
  v_status text;
  v_time timestamptz;
  v_result jsonb;
  v_cached jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role() <> 'admin'::public.user_role or not exists (
    select 1 from private.demo_accounts d where d.user_id = v_actor and d.can_advance_month
  ) then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_request_id is null or p_target_month is null or extract(day from p_target_month) <> 1 then
    perform private.raise_api_error('VALIDATION_ERROR');
  end if;
  v_cached := private.reserve_simple_operation(v_actor, 'advance_demo_month', p_request_id,
    private.hash_payload(jsonb_build_object('targetMonth', p_target_month)));
  if v_cached is not null then return v_cached; end if;

  select c.current_month into v_current from private.demo_clock c where c.id = 'hackathon' for update;
  if v_current is null then perform private.raise_api_error('CONFIG_INVALID'); end if;
  select m.result into v_result from private.demo_month_runs m where m.target_month = p_target_month;
  if found then
    v_result := jsonb_set(v_result, '{applied}', 'false'::jsonb, true);
    perform private.finish_simple_operation(v_actor, 'advance_demo_month', p_request_id, v_result);
    return v_result;
  end if;
  v_closed := v_current;
  if p_target_month <> (v_current + interval '1 month')::date then
    perform private.raise_api_error('INVALID_MONTH_TRANSITION', jsonb_build_object('currentMonth', v_current, 'requestedMonth', p_target_month));
  end if;

  select (g.value ->> 'monthly_min_rounds')::integer,
    (g.value ->> 'per_round_delta')::numeric,
    (g.value ->> 'max')::numeric
  into v_target_rounds, v_delta, v_max from public.game_config g where g.key = 'gauge';
  if v_target_rounds is null or v_target_rounds < 0 or v_delta is null or v_delta <= 0 or v_delta > 100
     or v_delta * 10 <> trunc(v_delta * 10) or v_max is null or v_max <= 0 or v_max > 100 then
    perform private.raise_api_error('CONFIG_INVALID');
  end if;

  for v_member in
    select rm.room_id, rm.user_id from public.room_members rm
    join private.demo_accounts d on d.user_id = rm.user_id
    where rm.status = 'active'
    order by rm.room_id, rm.user_id
    for update of rm
  loop null; end loop;

  for v_member in
    select p.room_id, p.user_id, p.id from private.room_member_periods p
    join public.room_members rm on rm.room_id = p.room_id and rm.user_id = p.user_id and rm.status = 'active'
    join private.demo_accounts d on d.user_id = p.user_id
    where p.left_at is null
    order by p.room_id, p.user_id, p.id
    for update of p
  loop null; end loop;

  for v_member in
    select distinct rm.room_id from public.room_members rm
    join private.demo_accounts d on d.user_id = rm.user_id
    where rm.status = 'active'
    order by rm.room_id
  loop
    perform private.lock_room(v_member.room_id);
  end loop;

  for v_member in
    select rm.room_id, rm.user_id, rm.gauge, rm.joined_month
    from public.room_members rm join private.demo_accounts d on d.user_id = rm.user_id
    where rm.status = 'active'
    order by rm.room_id, rm.user_id
  loop
    select count(*)::integer into v_count from public.rounds r
    where r.user_id = v_member.user_id and r.clock_kind = 'demo' and r.period_month = v_closed;
    v_previous := v_member.gauge;
    v_gauge := v_previous;
    v_status := 'active';
    if v_member.joined_month <> v_closed then
      v_gauge := greatest(0, least(v_max, v_previous + (v_count - v_target_rounds) * v_delta))::numeric(5,1);
      if v_gauge = 0 then v_status := 'left'; end if;
    end if;
    v_time := private.next_room_write_time(v_member.room_id);
    update public.room_members rm set gauge = v_gauge, status = v_status,
      left_at = case when v_status = 'left' then v_time else null end,
      left_month = case when v_status = 'left' then p_target_month else null end,
      updated_at = v_time
    where rm.room_id = v_member.room_id and rm.user_id = v_member.user_id;
    if v_status = 'left' then
      update private.room_member_periods p set left_at = v_time
      where p.room_id = v_member.room_id and p.user_id = v_member.user_id and p.left_at is null;
    end if;
    v_members := v_members || jsonb_build_array(jsonb_build_object(
      'roomId', v_member.room_id, 'userId', v_member.user_id, 'roundCount', v_count,
      'previousGauge', v_previous, 'gauge', v_gauge, 'status', v_status));
  end loop;

  update private.demo_clock c set current_month = p_target_month, version = c.version + 1 where c.id = 'hackathon';
  v_result := jsonb_build_object('closedMonth', v_closed, 'currentMonth', p_target_month, 'applied', true, 'members', v_members);
  insert into private.demo_month_runs (closed_month, target_month, actor_id, request_id, result)
  values (v_closed, p_target_month, v_actor, p_request_id, v_result);
  perform private.finish_simple_operation(v_actor, 'advance_demo_month', p_request_id, v_result);
  return v_result;
end;
$function$;

revoke all on function private.raise_api_error(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.hash_payload(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.reserve_simple_operation(uuid, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.finish_simple_operation(uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.next_room_write_time(uuid) from public, anon, authenticated, service_role;
revoke all on function private.lock_user(uuid) from public, anon, authenticated, service_role;
revoke all on function private.lock_room(uuid) from public, anon, authenticated, service_role;
revoke all on function private.current_actor_clock_kind() from public, anon, authenticated, service_role;
grant execute on function private.current_actor_clock_kind() to authenticated;
revoke all on function public.get_my_round_gauge_summary() from public, anon, authenticated, service_role;
revoke all on function public.complete_round(uuid, public.card_grade) from public, anon, authenticated, service_role;
revoke all on function public.upgrade_card(uuid, uuid, public.card_grade) from public, anon, authenticated, service_role;
revoke all on function public.join_room(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.advance_demo_month(uuid, date) from public, anon, authenticated, service_role;
revoke all on public.collection_view, public.inventory_view, public.room_catalog from public, anon, authenticated, service_role;
grant select on public.collection_view, public.inventory_view, public.room_catalog to authenticated;
grant execute on function public.get_my_round_gauge_summary() to authenticated;
grant execute on function public.complete_round(uuid, public.card_grade) to authenticated;
grant execute on function public.upgrade_card(uuid, uuid, public.card_grade) to authenticated;
grant execute on function public.join_room(uuid, uuid) to authenticated;
grant execute on function public.advance_demo_month(uuid, date) to authenticated;
