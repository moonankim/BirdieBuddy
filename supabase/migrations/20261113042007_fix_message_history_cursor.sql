-- Keep the oldest-first page format while advancing older history without overlap.
-- CREATE OR REPLACE preserves the existing authenticated-only EXECUTE grant.
create or replace function public.get_messages(p_room_id uuid,p_before_id text default null,p_after_id text default null,p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_items jsonb; v_count integer; v_next text;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_before_id is not null and p_after_id is not null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if p_limit<1 or p_limit>100 then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not private.is_room_owner(p_room_id) and not private.is_active_member(p_room_id,v_actor) then perform private.raise_api_error('ROOM_INACTIVE'); end if;
  if p_before_id is not null and p_before_id !~ '^[1-9][0-9]{0,18}$' then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if p_after_id is not null and p_after_id !~ '^[1-9][0-9]{0,18}$' then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if p_after_id is null then
    select coalesce(jsonb_agg(private.message_json(x.id,v_actor) order by x.id),'[]'::jsonb),count(*)::integer
      into v_items,v_count from (
        select m.* from public.messages m where m.room_id=p_room_id
          and (p_before_id is null or m.id<p_before_id::bigint)
          and private.can_read_message(m.id,m.room_id,m.sender_id,m.sender_type,m.message_kind,m.recipient_user_id,m.created_at)
        order by m.id desc limit p_limit+1
      ) x;
    -- Drop the extra oldest row; beforeId must be the smallest returned id.
    if v_count>p_limit then
      select min((value->>'id')::bigint)::text into v_next from jsonb_array_elements(v_items) with ordinality as e(value,ordinality) where ordinality>1;
      return jsonb_build_object('items',(select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) from jsonb_array_elements(v_items) with ordinality as e(value,ordinality) where ordinality>1),'nextCursor',v_next);
    end if;
    return jsonb_build_object('items',v_items,'nextCursor',null);
  else
    select coalesce(jsonb_agg(private.message_json(x.id,v_actor) order by x.id),'[]'::jsonb),count(*)::integer
      into v_items,v_count from (
        select m.* from public.messages m where m.room_id=p_room_id and m.id>p_after_id::bigint
          and private.can_read_message(m.id,m.room_id,m.sender_id,m.sender_type,m.message_kind,m.recipient_user_id,m.created_at)
        order by m.id limit p_limit+1
      ) x;
    if v_count>p_limit then
      select max((value->>'id')::bigint)::text into v_next from jsonb_array_elements(v_items) with ordinality as e(value,ordinality) where ordinality<=p_limit;
      return jsonb_build_object('items',(select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) from jsonb_array_elements(v_items) with ordinality as e(value,ordinality) where ordinality<=p_limit),'nextCursor',v_next);
    end if;
    return jsonb_build_object('items',v_items,'nextCursor',null);
  end if;
end;
$function$;
