create table private.room_read_states (
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  last_read_message_id bigint,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (room_id, user_id),
  foreign key (room_id, last_read_message_id)
    references public.messages (room_id, id) on delete restrict
);

create table private.inbox_read_states (
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  last_checked_message_id bigint,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (room_id, user_id),
  foreign key (room_id, last_checked_message_id)
    references public.messages (room_id, id) on delete restrict
);

alter table private.room_read_states enable row level security;
alter table private.inbox_read_states enable row level security;
revoke all on table private.room_read_states from public, anon, authenticated, service_role;
revoke all on table private.inbox_read_states from public, anon, authenticated, service_role;

create policy room_read_states_actor_select on private.room_read_states
  for select to authenticated using (
    user_id = (select auth.uid())
    and private.current_role() = 'user'::public.user_role
  );

create policy inbox_read_states_owner_select on private.inbox_read_states
  for select to authenticated using (
    user_id = (select auth.uid())
    and private.current_role() = 'influencer'::public.user_role
    and private.is_verified_room_owner(room_id)
  );

create or replace function public.get_room_read_state(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_last_read bigint;
  v_first_unread text;
  v_unread_count integer;
  v_has_state boolean;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_room_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if private.current_role() is distinct from 'user'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  if not private.is_active_member(p_room_id, v_actor) then perform private.raise_api_error('ROOM_INACTIVE'); end if;

  select s.last_read_message_id into v_last_read
  from private.room_read_states s
  where s.room_id = p_room_id and s.user_id = v_actor;
  v_has_state := found;

  if not v_has_state then
    return jsonb_build_object(
      'roomId', p_room_id,
      'lastReadMessageId', null,
      'firstUnreadMessageId', null,
      'unreadCount', 0
    );
  end if;

  select min(m.id)::text, count(*)::integer
    into v_first_unread, v_unread_count
  from public.messages m
  where m.room_id = p_room_id
    and m.sender_type = 'influencer'
    and m.body is not null
    and m.deleted_at is null
    and (v_last_read is null or m.id > v_last_read)
    and private.can_read_message(
      m.id, m.room_id, m.sender_id, m.sender_type, m.message_kind,
      m.recipient_user_id, m.created_at
    );

  return jsonb_build_object(
    'roomId', p_room_id,
    'lastReadMessageId', v_last_read::text,
    'firstUnreadMessageId', v_first_unread,
    'unreadCount', coalesce(v_unread_count, 0)
  );
end;
$function$;

create or replace function public.get_my_room_unread_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role() is distinct from 'user'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'roomId', rm.room_id,
      'unreadCount', (public.get_room_read_state(rm.room_id)->>'unreadCount')::integer
    ) order by rm.room_id
  ), '[]'::jsonb)
    into v_result
  from public.room_members rm
  where rm.user_id = v_actor and rm.status = 'active';

  return v_result;
end;
$function$;

create or replace function public.mark_room_read(
  p_room_id uuid,
  p_last_read_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_target bigint;
  v_last_read bigint;
  v_time timestamptz := statement_timestamp();
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_room_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if private.current_role() is distinct from 'user'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  if not private.is_active_member(p_room_id, v_actor) then perform private.raise_api_error('ROOM_INACTIVE'); end if;
  if p_last_read_message_id is not null and p_last_read_message_id !~ '^[1-9][0-9]{0,18}$' then
    perform private.raise_api_error('VALIDATION_ERROR');
  end if;

  if p_last_read_message_id is not null then
    select m.id into v_target
    from public.messages m
    where m.room_id = p_room_id
      and m.id_text = p_last_read_message_id
      and private.can_read_message(
        m.id, m.room_id, m.sender_id, m.sender_type, m.message_kind,
        m.recipient_user_id, m.created_at
      );
    if not found then perform private.raise_api_error('FORBIDDEN'); end if;
  end if;

  insert into private.room_read_states(room_id, user_id, last_read_message_id, updated_at)
  values (p_room_id, v_actor, v_target, v_time)
  on conflict (room_id, user_id) do update
    set last_read_message_id = case
          when private.room_read_states.last_read_message_id is null then excluded.last_read_message_id
          when excluded.last_read_message_id is null then private.room_read_states.last_read_message_id
          else greatest(private.room_read_states.last_read_message_id, excluded.last_read_message_id)
        end,
        updated_at = greatest(private.room_read_states.updated_at, excluded.updated_at)
  returning last_read_message_id into v_last_read;

  return jsonb_build_object('lastReadMessageId', v_last_read::text);
end;
$function$;

create or replace function public.get_inbox_read_state(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_last_checked bigint;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_room_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if private.current_role() is distinct from 'influencer'::public.user_role
    or not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;

  select s.last_checked_message_id into v_last_checked
  from private.inbox_read_states s
  where s.room_id = p_room_id and s.user_id = v_actor;

  return jsonb_build_object('roomId', p_room_id, 'lastCheckedMessageId', v_last_checked::text);
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
  if p_last_checked_message_id is not null and p_last_checked_message_id !~ '^[1-9][0-9]{0,18}$' then
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
      and q.body is not null and q.deleted_at is null and q.passes_all_filters is true
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

  select max(q.id)::text
    into v_checked_through
  from public.messages q
  join public.room_members rm on rm.room_id = q.room_id and rm.user_id = q.sender_id and rm.status = 'active'
  join private.room_member_periods mp on mp.room_id = q.room_id and mp.user_id = q.sender_id and mp.left_at is null
    and q.created_at >= mp.joined_at
  where q.room_id = p_room_id
    and q.message_kind = 'user_question'
    and q.body is not null and q.deleted_at is null and q.passes_all_filters is true;

  select count(*)::integer
    into v_new_count
  from public.messages q
  join public.room_members rm on rm.room_id = q.room_id and rm.user_id = q.sender_id and rm.status = 'active'
  join private.room_member_periods mp on mp.room_id = q.room_id and mp.user_id = q.sender_id and mp.left_at is null
    and q.created_at >= mp.joined_at
  where q.room_id = p_room_id
    and q.message_kind = 'user_question'
    and q.body is not null and q.deleted_at is null and q.passes_all_filters is true
    and (v_last_checked is null or q.id > v_last_checked)
    and not exists (
      select 1
      from private.answer_question_links l
      join public.messages a on a.id = l.answer_id and a.deleted_at is null
      where l.question_id = q.id
    );

  select coalesce(jsonb_agg(
    p.item || jsonb_build_object('isNew', p.is_new) order by p.ordinality
  ), '[]'::jsonb)
    into v_items
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
        and q.body is not null and q.deleted_at is null and q.passes_all_filters is true
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

revoke all on function public.get_room_read_state(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_my_room_unread_counts() from public, anon, authenticated, service_role;
revoke all on function public.mark_room_read(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.get_inbox_read_state(uuid) from public, anon, authenticated, service_role;
revoke all on function public.mark_inbox_checked(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.get_room_inbox_with_read_state(uuid, boolean, jsonb, integer) from public, anon, authenticated, service_role;

grant execute on function public.get_room_read_state(uuid) to authenticated;
grant execute on function public.get_my_room_unread_counts() to authenticated;
grant execute on function public.mark_room_read(uuid, text) to authenticated;
grant execute on function public.get_inbox_read_state(uuid) to authenticated;
grant execute on function public.mark_inbox_checked(uuid, text) to authenticated;
grant execute on function public.get_room_inbox_with_read_state(uuid, boolean, jsonb, integer) to authenticated;
