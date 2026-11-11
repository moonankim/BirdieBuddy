create or replace function private.filter_reason(p_category text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case p_category
    when 'profanity' then '욕설이나 비속어가 포함되어 메시지가 전송되지 않았어요. 거친 표현은 빼고 부드러운 말로 바꿔 주시면 감사하겠어요.'
    when 'belittling' then '상대를 깎아내리는 표현이 포함되어 메시지가 전송되지 않았어요. 상대의 의견을 존중하는 말투로 다시 작성해 주세요.'
    when 'appearance' then '외모나 몸매를 평가하는 표현이 포함되어 메시지가 전송되지 않았어요. 외모 대신 스크린골프 플레이나 대화 주제에 집중해 주세요.'
    when 'threat' then '상대에게 해를 끼치겠다는 내용은 전송할 수 없어요.'
    when 'stalking' then '상대의 위치나 일상을 살피는 내용은 전송할 수 없어요.'
    when 'sexual_harassment' then '성적인 언급이나 요구가 포함되어 전송할 수 없어요.'
    when 'privacy' then '주소, 연락처 등 개인 정보를 묻거나 공개하는 내용은 전송할 수 없어요.'
    when 'hate' then '특정 집단에 대한 혐오 표현은 전송할 수 없어요.'
    when 'illegal_ad' then '불법 광고나 도박 홍보 내용은 전송할 수 없어요.'
    when 'spam' then '같은 내용의 반복이나 무의미한 글은 전송할 수 없어요.'
    else null end
$function$;

create or replace function private.message_json(p_message_id bigint, p_actor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', m.id_text, 'roomId', m.room_id, 'senderId', m.sender_id,
    'senderType', m.sender_type, 'messageKind', m.message_kind,
    'recipientUserId', m.recipient_user_id, 'senderName', m.sender_name,
    'body', m.body, 'replyTo', m.reply_to_text, 'replyContext', m.reply_context,
    'deletedAt', m.deleted_at, 'passesAllFilters', m.passes_all_filters,
    'isReplyToMe', coalesce(m.message_kind = 'influencer_answer' and exists (
      select 1 from private.answer_question_links l
      join public.messages q on q.id = l.question_id
      where l.answer_id = m.id and q.sender_id = p_actor_id
    ), false),
    'createdAt', m.created_at, 'updatedAt', m.updated_at, 'clusterId', m.cluster_id,
    'supportBadge', m.support_badge, 'ownScore', m.own_score,
    'qualityScore', m.quality_score, 'priority', m.priority
  )
  from public.messages m where m.id = p_message_id
$function$;

create or replace function public.internal_hash_payload(p_payload jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $function$
  select private.hash_payload(p_payload)
$function$;

create or replace function public.get_my_answer_links(p_room_id uuid, p_answer_ids bigint[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role() <> 'user'::public.user_role or not private.is_active_member(p_room_id, v_actor) then
    perform private.raise_api_error('ROOM_INACTIVE');
  end if;
  if p_room_id is null or p_answer_ids is null or cardinality(p_answer_ids) > 100 then
    perform private.raise_api_error('VALIDATION_ERROR');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('answerId', m.id_text, 'isReplyToMe', exists (
      select 1 from private.answer_question_links l
      join public.messages q on q.id = l.question_id
      where l.answer_id = m.id and q.sender_id = v_actor
    )) order by m.id), '[]'::jsonb)
    into v_items
  from public.messages m
  where m.room_id = p_room_id and m.id = any(p_answer_ids)
    and m.message_kind = 'influencer_answer'
    and private.can_read_message(m.id, m.room_id, m.sender_id, m.sender_type,
      m.message_kind, m.recipient_user_id, m.created_at);
  return jsonb_build_object('items', v_items);
end;
$function$;

create or replace function public.get_room_message_checkpoint(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid(); v_row record;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if not private.is_room_owner(p_room_id) and not private.is_active_member(p_room_id, v_actor) then
    perform private.raise_api_error('ROOM_INACTIVE');
  end if;
  select m.updated_at, m.id_text into v_row from public.messages m
  where m.room_id = p_room_id
    and private.can_read_message(m.id, m.room_id, m.sender_id, m.sender_type, m.message_kind, m.recipient_user_id, m.created_at)
  order by m.updated_at desc, m.id desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('updatedAt', v_row.updated_at, 'id', v_row.id_text);
end;
$function$;

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
    -- History is presented oldest-first; nextCursor is the smallest returned id for older pages.
    if v_count>p_limit then
      select max((value->>'id')::bigint)::text into v_next from jsonb_array_elements(v_items) with ordinality as e(value,ordinality) where ordinality>1;
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

create or replace function public.get_message_changes(
  p_room_id uuid,
  p_checkpoint_updated_at timestamptz,
  p_checkpoint_id text,
  p_through_updated_at timestamptz,
  p_through_id text,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id text default null,
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
  v_items jsonb;
  v_has_more boolean;
  v_next_updated_at timestamptz;
  v_next_id text;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if not private.is_room_owner(p_room_id) and not private.is_active_member(p_room_id, v_actor) then perform private.raise_api_error('ROOM_INACTIVE'); end if;
  if p_room_id is null or p_limit < 1 or p_limit > 100
     or (p_cursor_updated_at is null) <> (p_cursor_id is null)
     or (p_checkpoint_updated_at is null) <> (p_checkpoint_id is null)
     or (p_through_updated_at is null) <> (p_through_id is null)
     or (p_cursor_id is not null and p_cursor_id !~ '^[1-9][0-9]{0,18}$')
     or (p_checkpoint_id is not null and p_checkpoint_id !~ '^[1-9][0-9]{0,18}$')
     or (p_through_id is not null and p_through_id !~ '^[1-9][0-9]{0,18}$') then
    perform private.raise_api_error('VALIDATION_ERROR');
  end if;
  if p_through_id is null then return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null); end if;
  with eligible as (
    select m.* from public.messages m
    where m.room_id = p_room_id
      and private.can_read_message(m.id, m.room_id, m.sender_id, m.sender_type, m.message_kind, m.recipient_user_id, m.created_at)
      and (p_checkpoint_id is null or (m.updated_at, m.id) > (p_checkpoint_updated_at, p_checkpoint_id::bigint))
      and (m.updated_at, m.id) <= (p_through_updated_at, p_through_id::bigint)
      and (p_cursor_id is null or (m.updated_at, m.id) > (p_cursor_updated_at, p_cursor_id::bigint))
    order by m.updated_at, m.id limit p_limit + 1
  ), numbered as (
    select e.*, row_number() over (order by e.updated_at, e.id) ordinal from eligible e
  )
  select
    coalesce((select jsonb_agg(private.message_json(x.id, v_actor) order by x.updated_at, x.id) from numbered x where x.ordinal <= p_limit),'[]'::jsonb),
    (select count(*) > p_limit from numbered),
    (select x.updated_at from numbered x where x.ordinal=p_limit order by x.updated_at,x.id limit 1),
    (select x.id_text from numbered x where x.ordinal=p_limit order by x.updated_at,x.id limit 1)
  into v_items,v_has_more,v_next_updated_at,v_next_id;
  return jsonb_build_object('items', v_items,
    'nextCursor', case when v_has_more then jsonb_build_object('updatedAt', v_next_updated_at, 'id', v_next_id) else null end);
end;
$function$;

create or replace function public.begin_message_submission(
  p_actor_id uuid, p_room_id uuid, p_request_id uuid, p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_op private.operations%rowtype;
  v_token uuid := gen_random_uuid();
  v_inserted integer;
  v_count integer;
  v_blocked timestamptz;
  v_version integer;
  v_disabled text[];
begin
  if p_actor_id is null or p_room_id is null or p_request_id is null or p_payload_hash is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not exists (select 1 from public.profiles p where p.id = p_actor_id and p.role = 'user')
     or not private.is_active_member(p_room_id, p_actor_id) then perform private.raise_api_error('ROOM_INACTIVE'); end if;
  insert into private.operations(actor_id, operation, request_id, payload_hash, state, lease_token, lease_until)
  values (p_actor_id, 'submit-message', p_request_id, p_payload_hash, 'processing', v_token, clock_timestamp() + interval '30 seconds')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  select * into v_op from private.operations o
  where o.actor_id = p_actor_id and o.operation = 'submit-message' and o.request_id = p_request_id for update;
  if v_op.payload_hash <> p_payload_hash then perform private.raise_api_error('IDEMPOTENCY_CONFLICT'); end if;
  if v_op.state = 'succeeded' then return jsonb_build_object('state','succeeded','cachedResult',v_op.result); end if;
  if v_inserted = 0 and v_op.state = 'processing' and v_op.lease_until > clock_timestamp() then
    perform private.raise_api_error('REQUEST_IN_PROGRESS', jsonb_build_object('retryAfterMs', greatest(100, ceil(extract(epoch from (v_op.lease_until-clock_timestamp()))*1000)::integer)));
  end if;
  if v_inserted = 1 then
    select max(r.blocked_until), coalesce(sum(r.count) filter (where r.window_start >= clock_timestamp() - interval '10 seconds'),0)::integer
      into v_blocked, v_count from private.rate_windows r where r.actor_id=p_actor_id and r.operation='submit-message' and r.scope_id=p_actor_id;
    if v_blocked > clock_timestamp() then
      update private.operations set state='succeeded', result=jsonb_build_object('error','RATE_LIMITED','retryAfterSeconds',ceil(extract(epoch from (v_blocked-clock_timestamp())))::integer), lease_token=null, lease_until=null, updated_at=clock_timestamp()
       where actor_id=p_actor_id and operation='submit-message' and request_id=p_request_id;
      return jsonb_build_object('state','succeeded','cachedResult',jsonb_build_object('error','RATE_LIMITED','retryAfterSeconds',ceil(extract(epoch from (v_blocked-clock_timestamp())))::integer));
    end if;
    insert into private.rate_windows(actor_id,operation,scope_id,window_start,count)
    values (p_actor_id,'submit-message',p_actor_id,date_trunc('second',clock_timestamp()),1)
    on conflict(actor_id,operation,scope_id,window_start) do update set count=private.rate_windows.count+1;
    if v_count >= 5 then
      update private.rate_windows set blocked_until=clock_timestamp()+interval '30 seconds'
      where actor_id=p_actor_id and operation='submit-message' and scope_id=p_actor_id and window_start=date_trunc('second',clock_timestamp());
      update private.operations set state='succeeded', result=jsonb_build_object('error','RATE_LIMITED','retryAfterSeconds',30), lease_token=null, lease_until=null, updated_at=clock_timestamp()
      where actor_id=p_actor_id and operation='submit-message' and request_id=p_request_id;
      return jsonb_build_object('state','succeeded','cachedResult',jsonb_build_object('error','RATE_LIMITED','retryAfterSeconds',30));
    end if;
  end if;
  update private.operations set state='processing', lease_token=v_token, lease_until=clock_timestamp()+interval '30 seconds', result=null, updated_at=clock_timestamp()
  where actor_id=p_actor_id and operation='submit-message' and request_id=p_request_id;
  select s.version,s.disabled_filters into v_version,v_disabled from private.room_settings s where s.room_id=p_room_id;
  return jsonb_build_object('state','processing','leaseToken',v_token,'filterVersion',coalesce(v_version,1),'disabledFilters',coalesce(v_disabled,'{}'::text[]));
end;
$function$;

create or replace function public.submit_moderated_message(
  p_actor_id uuid, p_room_id uuid, p_request_id uuid, p_payload_hash text,
  p_lease_token uuid, p_filter_version integer, p_body text,
  p_verdict text default null, p_category text default null, p_quality numeric default null,
  p_passes_all_filters boolean default null, p_rewrite text default null,
  p_rewrite_quality numeric default null, p_suggestion_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_op private.operations%rowtype;
  v_settings private.room_settings%rowtype;
  v_suggestion private.moderation_suggestions%rowtype;
  v_actor_profile public.profiles%rowtype;
  v_time timestamptz;
  v_message_id bigint;
  v_token text;
  v_expires_at timestamptz;
  v_badge text := 'none';
  v_earned integer := 0;
  v_styles integer := 0;
  v_highest integer := 0;
  v_own numeric(5,2) := 0;
  v_priority numeric(5,2);
  v_own_weight numeric;
  v_quality_weight numeric;
  v_quality numeric(5,2);
  v_passes boolean;
  v_result jsonb;
  v_safe_result jsonb;
begin
  if p_actor_id is null or p_room_id is null or p_request_id is null or p_lease_token is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not exists (select 1 from public.profiles p where p.id=p_actor_id and p.role='user') or not private.is_active_member(p_room_id,p_actor_id) then perform private.raise_api_error('ROOM_INACTIVE'); end if;
  if char_length(btrim(p_body)) not between 1 and 2000 then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  select * into v_op from private.operations o where o.actor_id=p_actor_id and o.operation='submit-message' and o.request_id=p_request_id for update;
  if not found or v_op.payload_hash <> p_payload_hash then perform private.raise_api_error('IDEMPOTENCY_CONFLICT'); end if;
  if v_op.state='succeeded' then return coalesce(v_op.result,'{}'::jsonb); end if;
  if v_op.state <> 'processing' or v_op.lease_token <> p_lease_token or v_op.lease_until <= clock_timestamp() then perform private.raise_api_error('REQUEST_IN_PROGRESS'); end if;
  select * into v_settings from private.room_settings s where s.room_id=p_room_id;
  if coalesce(v_settings.version,1) <> p_filter_version then perform private.raise_api_error('FILTERS_CHANGED',jsonb_build_object('currentVersion',coalesce(v_settings.version,1))); end if;

  if p_suggestion_token is not null then
    if p_verdict is not null or p_category is not null or p_quality is not null or p_passes_all_filters is not null or p_rewrite_quality is not null or p_rewrite is not null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
    select * into v_suggestion from private.moderation_suggestions s
    where s.token_hash=encode(extensions.digest(p_suggestion_token,'sha256'),'hex') for update;
    if not found or v_suggestion.actor_id<>p_actor_id or v_suggestion.room_id<>p_room_id
      or v_suggestion.used_at is not null
      or v_suggestion.expires_at<=clock_timestamp()
      or v_suggestion.body_hash<>encode(extensions.digest(btrim(p_body),'sha256'),'hex') then
      return jsonb_build_object('needsModeration',true);
    end if;
    v_quality := v_suggestion.rewrite_quality;
    v_passes := true;
    update private.moderation_suggestions set used_at=clock_timestamp() where id=v_suggestion.id;
  else
    if p_verdict not in ('pass','suggest','block') or p_passes_all_filters is null or p_quality is null or p_quality<0 or p_quality>100 then perform private.raise_api_error('VALIDATION_ERROR'); end if;
    if p_verdict='pass' then
      if p_category is not null or p_rewrite is not null or p_rewrite_quality is not null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
      v_quality:=p_quality; v_passes:=p_passes_all_filters;
    elsif p_verdict='suggest' then
      if p_category is null or p_category not in ('profanity','belittling','appearance') or p_category=any(coalesce(v_settings.disabled_filters,'{}'::text[])) or p_passes_all_filters then perform private.raise_api_error('VALIDATION_ERROR'); end if;
      if p_rewrite is not null and (char_length(p_rewrite) not between 1 and 2000 or p_rewrite_quality not between 0 and 100) then perform private.raise_api_error('VALIDATION_ERROR'); end if;
      if p_rewrite is null and p_rewrite_quality is not null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
      v_token:=case when p_rewrite is not null then encode(extensions.gen_random_bytes(32),'hex') else null end;
      if v_token is not null then
        v_expires_at:=clock_timestamp()+interval '10 minutes';
        insert into private.moderation_suggestions(actor_id,room_id,request_id,token_hash,body_hash,rewrite_quality,expires_at)
        values(p_actor_id,p_room_id,p_request_id,encode(extensions.digest(v_token,'sha256'),'hex'),encode(extensions.digest(btrim(p_rewrite),'sha256'),'hex'),p_rewrite_quality,v_expires_at);
      end if;
      v_safe_result:=jsonb_build_object('verdict','suggest','category',p_category,'reason',private.filter_reason(p_category),'rewrite',null,'rewriteQuality',null,'suggestionToken',null,'expiresAt',null,'passesAllFilters',false,'message',null);
      insert into private.moderation_events(actor_id,room_id,request_id,verdict,category) values(p_actor_id,p_room_id,p_request_id,'suggest',p_category) on conflict do nothing;
      update private.operations set state='succeeded',result=v_safe_result,lease_token=null,lease_until=null,updated_at=clock_timestamp()
       where actor_id=p_actor_id and operation='submit-message' and request_id=p_request_id;
      return v_safe_result || jsonb_build_object('rewrite',p_rewrite,'rewriteQuality',p_rewrite_quality,'suggestionToken',v_token,'expiresAt',v_expires_at,'passesAllFilters',false,'message',null);
    else
      if p_category is null or p_category not in ('threat','stalking','sexual_harassment','privacy','hate','illegal_ad','spam') or p_passes_all_filters then perform private.raise_api_error('VALIDATION_ERROR'); end if;
      v_safe_result:=jsonb_build_object('verdict','block','category',p_category,'reason',private.filter_reason(p_category),'rewrite',null,'rewriteQuality',null,'suggestionToken',null,'expiresAt',null,'passesAllFilters',false,'message',null);
      insert into private.moderation_events(actor_id,room_id,request_id,verdict,category) values(p_actor_id,p_room_id,p_request_id,'block',p_category) on conflict do nothing;
      update private.operations set state='succeeded',result=v_safe_result,lease_token=null,lease_until=null,updated_at=clock_timestamp()
       where actor_id=p_actor_id and operation='submit-message' and request_id=p_request_id;
      return v_safe_result || jsonb_build_object('rewrite',null,'rewriteQuality',null,'suggestionToken',null,'expiresAt',null,'passesAllFilters',false,'message',null);
    end if;
  end if;

  perform private.lock_user(p_actor_id);
  perform private.lock_room(p_room_id);
  if not private.is_active_member(p_room_id,p_actor_id) then perform private.raise_api_error('ROOM_INACTIVE'); end if;
  select * into v_settings from private.room_settings s where s.room_id=p_room_id;
  if coalesce(v_settings.version,1) <> p_filter_version then perform private.raise_api_error('FILTERS_CHANGED'); end if;
  v_time:=private.next_room_write_time(p_room_id);
  select p.* into v_actor_profile from public.profiles p where p.id=p_actor_id;
  select count(d.id)::integer into v_earned
    from public.chat_rooms r join public.card_templates t on t.influencer_id=r.influencer_id
    join public.draws d on d.template_id=t.id where r.id=p_room_id and d.user_id=p_actor_id;
  select max(case uc.grade when 'special' then 4 when 'epic' then 3 when 'rare' then 2 when 'common' then 1 else 0 end),
    count(distinct t.style)::integer into v_highest,v_styles
    from public.chat_rooms r join public.card_templates t on t.influencer_id=r.influencer_id
    join public.user_cards uc on uc.template_id=t.id and uc.user_id=p_actor_id and uc.count>0
    where r.id=p_room_id;
  if v_earned>=15 and coalesce(v_highest,0)=4 then v_badge:='albatross';
  elsif v_earned>=15 or coalesce(v_highest,0)=4 then v_badge:='eagle';
  elsif v_earned>=10 or coalesce(v_highest,0)>=3 then v_badge:='buddy'; end if;
  v_own:=case v_badge when 'albatross' then 90 when 'eagle' then 60 when 'buddy' then 30 else 0 end + least(2,greatest(0,coalesce(v_styles,0)-1))*5;
  select (g.value->>'own')::numeric,(g.value->>'quality')::numeric into v_own_weight,v_quality_weight
    from public.game_config g where g.key='priority_weights';
  if v_own_weight is null or v_quality_weight is null or v_own_weight<0 or v_quality_weight<0 or v_own_weight+v_quality_weight<>1 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  v_priority:=round(v_own*v_own_weight+v_quality*v_quality_weight,2);
  insert into public.messages(id_text,room_id,sender_id,sender_type,message_kind,sender_name,body,passes_all_filters,support_badge,own_score,quality_score,priority,created_at,updated_at)
  values('0',p_room_id,p_actor_id,'user','user_question',v_actor_profile.nickname,btrim(p_body),v_passes,v_badge,v_own,v_quality,v_priority,v_time,v_time)
  returning id into v_message_id;
  update public.messages set id_text=id::text where id=v_message_id;
  v_result:=jsonb_build_object('verdict','pass','category',null,'reason',null,'rewrite',null,'rewriteQuality',null,'suggestionToken',null,'expiresAt',null,'passesAllFilters',v_passes,'message',private.message_json(v_message_id,p_actor_id));
  update private.operations set state='succeeded',result=v_result,lease_token=null,lease_until=null,updated_at=clock_timestamp()
  where actor_id=p_actor_id and operation='submit-message' and request_id=p_request_id;
  insert into private.moderation_events(actor_id,room_id,request_id,verdict,category) values(p_actor_id,p_room_id,p_request_id,'pass',null) on conflict do nothing;
  return v_result;
end;
$function$;

create or replace function public.fail_message_submission(
  p_actor_id uuid,p_request_id uuid,p_lease_token uuid,p_error_code text,p_operation text default 'submit-message'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_updated integer;
begin
  if p_actor_id is null or p_request_id is null or p_lease_token is null
     or p_operation not in ('submit-message','influencer-answer','influencer-broadcast','influencer-greeting')
     or p_error_code not in ('FILTER_UNAVAILABLE','INTERNAL_ERROR','NETWORK_ERROR','ROOM_INACTIVE','FILTERS_CHANGED','SOURCE_CHANGED') then
    perform private.raise_api_error('VALIDATION_ERROR');
  end if;
  update private.operations set state='failed',result=jsonb_build_object('error',p_error_code),lease_token=null,lease_until=null,updated_at=clock_timestamp()
  where actor_id=p_actor_id and operation=p_operation and request_id=p_request_id and state='processing' and lease_token=p_lease_token;
  get diagnostics v_updated=row_count;
  return jsonb_build_object('updated',v_updated=1);
end;
$function$;

create or replace function public.delete_influencer_message(p_request_id uuid, p_room_id uuid, p_message_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid(); v_cached jsonb; v_hash text; v_time timestamptz;
  v_message public.messages%rowtype; v_result jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_request_id is null or p_room_id is null or p_message_id is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  v_hash:=private.hash_payload(jsonb_build_object('roomId',p_room_id,'messageId',p_message_id::text));
  v_cached:=private.reserve_simple_operation(v_actor,'delete-influencer-message',p_request_id,v_hash);
  if v_cached is not null then return v_cached; end if;
  perform private.lock_room(p_room_id);
  select * into v_message from public.messages m where m.id=p_message_id and m.room_id=p_room_id
    and m.message_kind in ('influencer_answer','influencer_broadcast') and m.deleted_at is null for update;
  if not found or not exists (select 1 from private.influencer_accounts ia join public.chat_rooms r on r.influencer_id=ia.influencer_id where r.id=p_room_id and ia.user_id=v_actor)
    then perform private.raise_api_error('NOT_FOUND'); end if;
  v_time:=private.next_room_write_time(p_room_id);
  update public.messages set body=null,deleted_at=v_time,updated_at=v_time where id=p_message_id returning * into v_message;
  update public.message_clusters c set version=c.version+1,updated_at=v_time
    where c.id=v_message.cluster_id;
  v_result:=jsonb_build_object('message',private.message_json(v_message.id,v_actor));
  perform private.finish_simple_operation(v_actor,'delete-influencer-message',p_request_id,v_result);
  return v_result;
end;
$function$;

revoke all on function private.filter_reason(text) from public,anon,authenticated,service_role;
revoke all on function private.message_json(bigint,uuid) from public,anon,authenticated,service_role;
revoke all on function public.internal_hash_payload(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.get_my_answer_links(uuid,bigint[]) from public,anon,authenticated,service_role;
revoke all on function public.get_room_message_checkpoint(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_messages(uuid,text,text,integer) from public,anon,authenticated,service_role;
revoke all on function public.get_message_changes(uuid,timestamptz,text,timestamptz,text,timestamptz,text,integer) from public,anon,authenticated,service_role;
revoke all on function public.begin_message_submission(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.submit_moderated_message(uuid,uuid,uuid,text,uuid,integer,text,text,text,numeric,boolean,text,numeric,text) from public,anon,authenticated,service_role;
revoke all on function public.fail_message_submission(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.delete_influencer_message(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.get_my_answer_links(uuid,bigint[]) to authenticated;
grant execute on function public.get_room_message_checkpoint(uuid) to authenticated;
grant execute on function public.get_messages(uuid,text,text,integer) to authenticated;
grant execute on function public.get_message_changes(uuid,timestamptz,text,timestamptz,text,timestamptz,text,integer) to authenticated;
grant execute on function public.begin_message_submission(uuid,uuid,uuid,text) to service_role;
grant execute on function public.submit_moderated_message(uuid,uuid,uuid,text,uuid,integer,text,text,text,numeric,boolean,text,numeric,text) to service_role;
grant execute on function public.fail_message_submission(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.internal_hash_payload(jsonb) to service_role;
grant execute on function public.delete_influencer_message(uuid,uuid,bigint) to authenticated;

alter publication supabase_realtime add table public.messages;
