-- The room owner may inspect every question that passed the configured
-- moderation policy. `passes_all_filters` is stricter: it controls exposure
-- to other fans and AI-generated sources, not the owner's private inbox.
create or replace function public.get_room_inbox(
  p_room_id uuid,
  p_include_answered boolean default false,
  p_cursor jsonb default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_revision text;
  v_items jsonb;
  v_next jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  if p_limit < 1 or p_limit > 100 then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if p_cursor is not null and (
    jsonb_typeof(p_cursor) <> 'object'
    or p_cursor->>'revision' is null
    or p_cursor->>'priority' !~ '^-?[0-9]+(\.[0-9]+)?$'
    or p_cursor->>'tieMessageId' !~ '^[1-9][0-9]{0,18}$'
    or p_cursor->>'inboxKey' is null
  ) then perform private.raise_api_error('VALIDATION_ERROR'); end if;

  with questions as (
    select q.*, coalesce(q.cluster_id::text, '') cluster_key,
      exists (
        select 1 from private.answer_question_links l
        join public.messages a on a.id = l.answer_id
        where l.question_id = q.id and a.deleted_at is null
      ) answered,
      exists (
        select 1 from public.room_members rm
        where rm.room_id = q.room_id and rm.user_id = q.sender_id and rm.status = 'active'
      ) active
    from public.messages q
    where q.room_id = p_room_id
      and q.message_kind = 'user_question'
      and q.body is not null
      and q.passes_all_filters is not null
  ), revision as (
    select encode(extensions.digest(jsonb_build_object(
      'includeAnswered', p_include_answered,
      'questions', coalesce(jsonb_agg(
        jsonb_build_array(q.id_text, q.cluster_key, q.answered, q.active, q.priority)
        order by q.id
      ), '[]'::jsonb)
    )::text, 'sha256'), 'hex') value
    from questions q
  ), candidates as (
    select 'question:' || q.id_text inbox_key, q.priority, q.id tie_id,
      (select max(a.id) from private.answer_question_links l
        join public.messages a on a.id = l.answer_id
        where l.question_id = q.id and a.deleted_at is null) reply_id,
      q.answered, null::uuid cluster_id, null::integer cluster_version,
      private.message_json(q.id, v_actor) question_json,
      null::text representative, 1 member_count, array[q.id_text] message_ids
    from questions q
    where q.cluster_id is null and q.active and (p_include_answered or not q.answered)
    union all
    select 'cluster:' || c.id::text, max(q.priority), max(q.id), max(a.id),
      bool_and(q.answered), c.id, c.version, null::jsonb, c.representative,
      count(distinct q.sender_id)::integer, array_agg(q.id_text order by q.id)
    from public.message_clusters c
    join questions q on q.cluster_id = c.id and q.active
    left join lateral (
      select max(answer.id) id
      from private.answer_question_links l
      join public.messages answer on answer.id = l.answer_id and answer.deleted_at is null
      where l.question_id = q.id
    ) a on true
    where c.room_id = p_room_id and (p_include_answered or not q.answered)
    group by c.id, c.version, c.representative
  ), ordered as (
    select c.*, row_number() over (
      order by c.priority desc, c.tie_id desc, c.inbox_key
    ) rn
    from candidates c cross join revision r
    where p_cursor is null or (
      p_cursor->>'revision' = r.value
      and (c.priority, c.tie_id, c.inbox_key) < (
        (p_cursor->>'priority')::numeric,
        (p_cursor->>'tieMessageId')::bigint,
        p_cursor->>'inboxKey'
      )
    )
  ), page as (
    select * from ordered order by priority desc, tie_id desc, inbox_key limit p_limit + 1
  )
  select r.value,
    coalesce(jsonb_agg(jsonb_build_object(
      'inboxKey', p.inbox_key,
      'priority', p.priority,
      'tieMessageId', p.tie_id::text,
      'replyTo', p.tie_id::text,
      'answered', p.answered,
      'replyId', case when p.answered then p.reply_id::text else null end,
      'kind', case when p.cluster_id is null then 'question' else 'cluster' end,
      'expectedClusterId', p.cluster_id,
      'expectedClusterVersion', p.cluster_version,
      'question', p.question_json,
      'clusterId', p.cluster_id,
      'representative', p.representative,
      'memberCount', p.member_count,
      'activeMessageIds', p.message_ids
    ) order by p.priority desc, p.tie_id desc, p.inbox_key)
      filter (where p.rn <= p_limit), '[]'::jsonb),
    case when count(p.rn) > p_limit then jsonb_build_object(
      'revision', r.value,
      'priority', max(p.priority) filter (where p.rn = p_limit),
      'tieMessageId', max(p.tie_id) filter (where p.rn = p_limit)::text,
      'inboxKey', max(p.inbox_key) filter (where p.rn = p_limit)
    ) else null end
  into v_revision, v_items, v_next
  from revision r left join page p on true
  group by r.value;

  if p_cursor is not null and p_cursor->>'revision' is distinct from v_revision then
    perform private.raise_api_error('SOURCE_CHANGED');
  end if;
  return jsonb_build_object('items', v_items, 'nextCursor', v_next, 'revision', v_revision);
end;
$function$;

create or replace function public.mark_inbox_checked(
  p_room_id uuid,
  p_last_checked_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_target bigint;
  v_last_checked bigint;
  v_time timestamptz := statement_timestamp();
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_room_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if private.current_role() is distinct from 'influencer'::public.user_role
    or not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  if p_last_checked_message_id is not null
    and p_last_checked_message_id !~ '^[1-9][0-9]{0,18}$' then
    perform private.raise_api_error('VALIDATION_ERROR');
  end if;

  select s.last_checked_message_id into v_last_checked
  from private.inbox_read_states s
  where s.room_id = p_room_id and s.user_id = v_actor;

  if p_last_checked_message_id is not null then
    select q.id into v_target
    from public.messages q
    where q.room_id = p_room_id
      and q.id_text = p_last_checked_message_id
      and q.message_kind = 'user_question'
      and q.body is not null
      and q.deleted_at is null
      and q.passes_all_filters is not null
      and (
        exists (
          select 1
          from public.room_members rm
          join private.room_member_periods mp
            on mp.room_id = rm.room_id and mp.user_id = rm.user_id and mp.left_at is null
          where rm.room_id = q.room_id and rm.user_id = q.sender_id and rm.status = 'active'
            and q.created_at >= mp.joined_at
        )
        or (v_last_checked is not null and q.id <= v_last_checked)
      );
    if not found then perform private.raise_api_error('FORBIDDEN'); end if;
  end if;

  insert into private.inbox_read_states(room_id, user_id, last_checked_message_id, updated_at)
  values (p_room_id, v_actor, v_target, v_time)
  on conflict (room_id, user_id) do update
    set last_checked_message_id = case
          when private.inbox_read_states.last_checked_message_id is null then excluded.last_checked_message_id
          when excluded.last_checked_message_id is null then private.inbox_read_states.last_checked_message_id
          else greatest(private.inbox_read_states.last_checked_message_id, excluded.last_checked_message_id)
        end,
        updated_at = greatest(private.inbox_read_states.updated_at, excluded.updated_at)
  returning last_checked_message_id into v_last_checked;

  return jsonb_build_object('lastCheckedMessageId', v_last_checked::text);
end;
$function$;

create or replace function public.get_room_inbox_with_read_state(
  p_room_id uuid,
  p_include_answered boolean default false,
  p_cursor jsonb default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_page jsonb;
  v_items jsonb;
  v_last_checked bigint;
  v_checked_through text;
  v_new_count integer;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_room_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if private.current_role() is distinct from 'influencer'::public.user_role
    or not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;

  v_page := public.get_room_inbox(p_room_id, p_include_answered, p_cursor, p_limit);

  select s.last_checked_message_id into v_last_checked
  from private.inbox_read_states s
  where s.room_id = p_room_id and s.user_id = v_actor;

  select max(q.id)::text into v_checked_through
  from public.messages q
  join public.room_members rm on rm.room_id = q.room_id and rm.user_id = q.sender_id and rm.status = 'active'
  join private.room_member_periods mp on mp.room_id = q.room_id and mp.user_id = q.sender_id and mp.left_at is null
    and q.created_at >= mp.joined_at
  where q.room_id = p_room_id
    and q.message_kind = 'user_question'
    and q.body is not null and q.deleted_at is null and q.passes_all_filters is not null;

  select count(*)::integer into v_new_count
  from public.messages q
  join public.room_members rm on rm.room_id = q.room_id and rm.user_id = q.sender_id and rm.status = 'active'
  join private.room_member_periods mp on mp.room_id = q.room_id and mp.user_id = q.sender_id and mp.left_at is null
    and q.created_at >= mp.joined_at
  where q.room_id = p_room_id
    and q.message_kind = 'user_question'
    and q.body is not null and q.deleted_at is null and q.passes_all_filters is not null
    and (v_last_checked is null or q.id > v_last_checked)
    and not exists (
      select 1
      from private.answer_question_links l
      join public.messages a on a.id = l.answer_id and a.deleted_at is null
      where l.question_id = q.id
    );

  select coalesce(jsonb_agg(
    p.item || jsonb_build_object('isNew', p.is_new) order by p.ordinality
  ), '[]'::jsonb) into v_items
  from (
    select e.item, e.ordinality, exists (
      select 1
      from jsonb_array_elements_text(
        case when e.item->>'kind' = 'question'
          then jsonb_build_array(e.item #>> '{question,id}')
          else coalesce(e.item->'activeMessageIds', '[]'::jsonb)
        end
      ) ids(id)
      join public.messages q on q.id_text = ids.id and q.room_id = p_room_id
      join public.room_members rm on rm.room_id = q.room_id and rm.user_id = q.sender_id and rm.status = 'active'
      join private.room_member_periods mp on mp.room_id = q.room_id and mp.user_id = q.sender_id and mp.left_at is null
        and q.created_at >= mp.joined_at
      where q.message_kind = 'user_question'
        and q.body is not null and q.deleted_at is null and q.passes_all_filters is not null
        and (v_last_checked is null or q.id > v_last_checked)
        and not exists (
          select 1
          from private.answer_question_links l
          join public.messages a on a.id = l.answer_id and a.deleted_at is null
          where l.question_id = q.id
        )
    ) as is_new
    from jsonb_array_elements(coalesce(v_page->'items', '[]'::jsonb)) with ordinality as e(item, ordinality)
  ) p;

  return v_page || jsonb_build_object(
    'items', v_items,
    'newCount', coalesce(v_new_count, 0),
    'checkedThroughMessageId', v_checked_through
  );
end;
$function$;

revoke all on function public.get_room_inbox(uuid, boolean, jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public.mark_inbox_checked(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.get_room_inbox_with_read_state(uuid, boolean, jsonb, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_room_inbox(uuid, boolean, jsonb, integer) to authenticated;
grant execute on function public.mark_inbox_checked(uuid, text) to authenticated;
grant execute on function public.get_room_inbox_with_read_state(uuid, boolean, jsonb, integer) to authenticated;
