create or replace function private.actor_owns_verified_room(p_actor_id uuid, p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists(select 1 from public.chat_rooms r
    join public.influencers i on i.id=r.influencer_id and i.verified_at is not null
    join private.influencer_accounts a on a.influencer_id=i.id and a.user_id=p_actor_id
    where r.id=p_room_id)
$function$;

create or replace function public.get_my_influencer_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  select jsonb_build_object('influencerId',i.id,'influencerName',i.name,'verifiedAt',i.verified_at,
      'profileImagePath',i.profile_image_path,'fallbackImagePath',t.image_path)
    into v_result
  from private.influencer_accounts a join public.influencers i on i.id=a.influencer_id
  left join public.card_templates t on t.influencer_id=i.id and t.style='illust'
  where a.user_id=v_actor and i.verified_at is not null;
  if v_result is null then perform private.raise_api_error('FORBIDDEN'); end if;
  return v_result;
end;
$function$;

create or replace function public.get_room_filters(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  select jsonb_build_object('roomId',s.room_id,'disabledFilters',s.disabled_filters,
    'mandatoryFilters',array['hate','illegal_ad','privacy','sexual_harassment','spam','stalking','threat'],'version',s.version)
  into v_result from private.room_settings s where s.room_id=p_room_id;
  return coalesce(v_result,jsonb_build_object('roomId',p_room_id,'disabledFilters','[]'::jsonb,
    'mandatoryFilters',jsonb_build_array('hate','illegal_ad','privacy','sexual_harassment','spam','stalking','threat'),'version',1));
end;
$function$;

create or replace function public.get_room_greeting(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_name text; v_text text; v_version integer;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  select i.name, s.greeting_text, s.version into v_name,v_text,v_version
  from public.chat_rooms r join public.influencers i on i.id=r.influencer_id
  left join private.room_settings s on s.room_id=r.id where r.id=p_room_id;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;
  return jsonb_build_object('roomId',p_room_id,'text',coalesce(v_text,format('%s 채팅방에 오신 것을 환영합니다. 카드를 모아 찾아와 주셔서 감사합니다. 골프 이야기나 궁금한 점을 메시지로 보내 보세요.',v_name)),
    'isDefault',v_text is null,'maxLength',200,'version',coalesce(v_version,1));
end;
$function$;

create or replace function private.get_room_daily_block_count(p_actor_id uuid,p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_day date:= (statement_timestamp() at time zone 'Asia/Seoul')::date; v_count integer;
begin
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  select count(distinct (e.actor_id,e.request_id))::integer into v_count from private.moderation_events e
  where e.room_id=p_room_id and e.verdict='block' and (e.created_at at time zone 'Asia/Seoul')::date=v_day;
  return jsonb_build_object('roomId',p_room_id,'day',v_day,'count',coalesce(v_count,0));
end;
$function$;

create or replace function public.get_room_daily_block_count(p_room_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if auth.uid() is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  return private.get_room_daily_block_count(auth.uid(),p_room_id);
end;
$function$;

create or replace function public.update_room_filters(
  p_request_id uuid,p_room_id uuid,p_disabled_filters text[],p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_normalized text[]; v_settings private.room_settings%rowtype;
  v_cached jsonb; v_result jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  if p_request_id is null or p_disabled_filters is null or p_expected_version is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if exists(select 1 from unnest(p_disabled_filters) f where f not in ('profanity','belittling','appearance')) then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  select coalesce(array_agg(distinct f order by f),'{}'::text[]) into v_normalized from unnest(p_disabled_filters) f;
  v_cached:=private.reserve_simple_operation(v_actor,'update-room-filters',p_request_id,
    private.hash_payload(jsonb_build_object('roomId',p_room_id,'disabledFilters',v_normalized,'expectedVersion',p_expected_version)));
  if v_cached is not null then return v_cached; end if;
  perform private.lock_room(p_room_id);
  insert into private.room_settings(room_id) values(p_room_id) on conflict do nothing;
  select * into v_settings from private.room_settings s where s.room_id=p_room_id for update;
  if v_settings.version<>p_expected_version then perform private.raise_api_error('FILTERS_CHANGED',jsonb_build_object('currentVersion',v_settings.version)); end if;
  update private.room_settings set disabled_filters=v_normalized,version=version+1 where room_id=p_room_id returning * into v_settings;
  v_result:=jsonb_build_object('roomId',p_room_id,'disabledFilters',v_settings.disabled_filters,'version',v_settings.version);
  perform private.finish_simple_operation(v_actor,'update-room-filters',p_request_id,v_result);
  return v_result;
end;
$function$;

create or replace function public.update_game_config(p_request_id uuid,p_key text,p_value jsonb,p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_old public.game_config%rowtype; v_result jsonb; v_cached jsonb;
  v_sum numeric;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role()<>'admin'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_request_id is null or p_key is null or p_value is null or p_expected_version is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  v_cached:=private.reserve_simple_operation(v_actor,'update-game-config',p_request_id,private.hash_payload(jsonb_build_object('key',p_key,'value',p_value,'expectedVersion',p_expected_version)));
  if v_cached is not null then return v_cached; end if;
  select * into v_old from public.game_config g where g.key=p_key for update;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;
  if v_old.version<>p_expected_version then perform private.raise_api_error('IDEMPOTENCY_CONFLICT',jsonb_build_object('currentVersion',v_old.version)); end if;
  if p_key='grade_rates' then
    if jsonb_typeof(p_value)<>'object' or (select count(*) from jsonb_object_keys(p_value))<>4
      or exists(select 1 from jsonb_each(p_value) e where e.key not in ('common','rare','epic','special') or jsonb_typeof(e.value)<>'number' or (e.value#>>'{}') !~ '^[0-9]+(\.[0-9]+)?$') then perform private.raise_api_error('CONFIG_INVALID'); end if;
    select sum((value#>>'{}')::numeric) into v_sum from jsonb_each(p_value); if v_sum<>100 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  elsif p_key='upgrade_cost' then
    if jsonb_typeof(p_value)<>'number' or (p_value#>>'{}') !~ '^[1-9][0-9]*$' or length(p_value#>>'{}')>10 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  elsif p_key='room_entry' then
    if jsonb_typeof(p_value)<>'object' or (select count(*) from jsonb_object_keys(p_value))<>1
      or jsonb_typeof(p_value->'min_earned_draws') is distinct from 'number' or (p_value->>'min_earned_draws') !~ '^[1-9][0-9]*$'
      or length(p_value->>'min_earned_draws')>10 then perform private.raise_api_error('CONFIG_INVALID'); end if;
    if (p_value->>'min_earned_draws')::numeric>2147483647 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  elsif p_key='priority_weights' then
    if jsonb_typeof(p_value)<>'object' or (select count(*) from jsonb_object_keys(p_value))<>2
       or not (p_value?'own') or not (p_value?'quality')
       or jsonb_typeof(p_value->'own') is distinct from 'number' or jsonb_typeof(p_value->'quality') is distinct from 'number'
       or (p_value->>'own') !~ '^[0-9]+(\.[0-9]+)?$' or (p_value->>'quality') !~ '^[0-9]+(\.[0-9]+)?$' then perform private.raise_api_error('CONFIG_INVALID'); end if;
    if (p_value->>'own')::numeric+(p_value->>'quality')::numeric<>1 then perform private.raise_api_error('CONFIG_INVALID'); end if;
  elsif p_key='gauge' then
    if jsonb_typeof(p_value)<>'object' or (select count(*) from jsonb_object_keys(p_value))<>4
       or not (p_value?'start') or not (p_value?'max') or not (p_value?'monthly_min_rounds') or not (p_value?'per_round_delta')
       or jsonb_typeof(p_value->'start') is distinct from 'number' or jsonb_typeof(p_value->'max') is distinct from 'number'
       or jsonb_typeof(p_value->'monthly_min_rounds') is distinct from 'number' or jsonb_typeof(p_value->'per_round_delta') is distinct from 'number'
       or (p_value->>'start') !~ '^[1-9][0-9]*$' or (p_value->>'max') !~ '^[1-9][0-9]*$'
       or (p_value->>'monthly_min_rounds') !~ '^(0|[1-9][0-9]*)$'
       or length(p_value->>'monthly_min_rounds')>10 or (p_value->>'per_round_delta') !~ '^[0-9]+(\.[0-9]+)?$' then perform private.raise_api_error('CONFIG_INVALID'); end if;
    if (p_value->>'monthly_min_rounds')::numeric>2147483647 then perform private.raise_api_error('CONFIG_INVALID'); end if;
    if (p_value->>'start')::numeric>(p_value->>'max')::numeric or (p_value->>'max')::numeric>100
       or (p_value->>'per_round_delta')::numeric<=0 or (p_value->>'per_round_delta')::numeric>100
       or (p_value->>'per_round_delta')::numeric*10<>trunc((p_value->>'per_round_delta')::numeric*10) then perform private.raise_api_error('CONFIG_INVALID'); end if;
  else perform private.raise_api_error('VALIDATION_ERROR'); end if;
  update public.game_config set value=p_value,version=version+1,updated_at=clock_timestamp() where key=p_key returning * into v_old;
  v_result:=jsonb_build_object('key',v_old.key,'value',v_old.value,'version',v_old.version,'updatedAt',v_old.updated_at);
  perform private.finish_simple_operation(v_actor,'update-game-config',p_request_id,v_result);
  return v_result;
end;
$function$;

create or replace function public.request_verification(p_request_id uuid,p_type public.influencer_type,p_evidence_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_influencer uuid; v_verification public.verifications%rowtype;
  v_result jsonb; v_cached jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_request_id is null or p_type is null or p_evidence_url is null or char_length(p_evidence_url) not between 1 and 2048 or p_evidence_url !~ '^https://' then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  select influencer_id into v_influencer from private.influencer_accounts where user_id=v_actor;
  if v_influencer is null then perform private.raise_api_error('FORBIDDEN'); end if;
  v_cached:=private.reserve_simple_operation(v_actor,'request-verification',p_request_id,private.hash_payload(jsonb_build_object('type',p_type,'evidenceUrl',p_evidence_url)));
  if v_cached is not null then return v_cached; end if;
  if exists(select 1 from public.influencers i where i.id=v_influencer and i.verified_at is not null) then perform private.raise_api_error('ALREADY_REVIEWED'); end if;
  insert into public.verifications(influencer_id,type,evidence_url,status) values(v_influencer,p_type,p_evidence_url,'pending') returning * into v_verification;
  v_result:=jsonb_build_object('verification',jsonb_build_object('id',v_verification.id,'influencerId',v_verification.influencer_id,'type',v_verification.type,'evidenceUrl',v_verification.evidence_url,'status',v_verification.status,'createdAt',v_verification.created_at,'reviewedAt',null,'rejectionReason',null));
  perform private.finish_simple_operation(v_actor,'request-verification',p_request_id,v_result);
  return v_result;
exception when unique_violation then
  perform private.raise_api_error('PENDING_EXISTS');
  return '{}'::jsonb;
end;
$function$;

create or replace function public.approve_verification(p_request_id uuid,p_verification_id uuid,p_decision text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_verification public.verifications%rowtype; v_result jsonb; v_cached jsonb;
  v_hash text; v_time timestamptz:=clock_timestamp();
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if private.current_role()<>'admin'::public.user_role then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_request_id is null or p_verification_id is null or p_decision not in ('approved','rejected')
     or (p_decision='rejected' and char_length(coalesce(p_reason,'')) not between 1 and 500)
     or (p_decision='approved' and p_reason is not null) then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  v_hash:=private.hash_payload(jsonb_build_object('verificationId',p_verification_id,'decision',p_decision,'reason',p_reason));
  v_cached:=private.reserve_simple_operation(v_actor,'approve-verification',p_request_id,v_hash);
  if v_cached is not null then return v_cached; end if;
  select * into v_verification from public.verifications v where v.id=p_verification_id for update;
  if not found then perform private.raise_api_error('NOT_FOUND'); end if;
  if v_verification.status<>'pending' then perform private.raise_api_error('ALREADY_REVIEWED'); end if;
  update public.verifications set status=p_decision,reviewed_by=v_actor,reviewed_at=v_time,
    rejection_reason=case when p_decision='rejected' then btrim(p_reason) else null end
   where id=p_verification_id returning * into v_verification;
  insert into private.verification_reviews(verification_id,reviewer_id,decision,reason,reviewed_at)
    values(p_verification_id,v_actor,p_decision,case when p_decision='rejected' then btrim(p_reason) else null end,v_time);
  if p_decision='approved' then
    update public.influencers set type=v_verification.type,verified_at=v_time where id=v_verification.influencer_id;
    insert into public.chat_rooms(influencer_id) values(v_verification.influencer_id) on conflict(influencer_id) do nothing;
    insert into private.room_settings(room_id) select id from public.chat_rooms where influencer_id=v_verification.influencer_id on conflict do nothing;
  end if;
  v_result:=jsonb_build_object('verification',jsonb_build_object('id',v_verification.id,'influencerId',v_verification.influencer_id,'type',v_verification.type,'evidenceUrl',v_verification.evidence_url,'status',v_verification.status,'createdAt',v_verification.created_at,'reviewedAt',v_verification.reviewed_at,'rejectionReason',v_verification.rejection_reason),'verifiedAt',case when p_decision='approved' then v_time else null end);
  perform private.finish_simple_operation(v_actor,'approve-verification',p_request_id,v_result);
  return v_result;
end;
$function$;

create or replace function public.begin_influencer_message_submission(
  p_actor_id uuid,p_room_id uuid,p_request_id uuid,p_kind text,p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_op private.operations%rowtype; v_token uuid:=gen_random_uuid(); v_inserted integer; v_settings private.room_settings%rowtype;
begin
  if p_request_id is null or p_actor_id is null or p_room_id is null or p_payload_hash is null or p_kind not in ('answer','broadcast','greeting') then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  insert into private.operations(actor_id,operation,request_id,payload_hash,state,lease_token,lease_until)
  values(p_actor_id,'influencer-'||p_kind,p_request_id,p_payload_hash,'processing',v_token,clock_timestamp()+interval '30 seconds') on conflict do nothing;
  get diagnostics v_inserted=row_count;
  select * into v_op from private.operations o where o.actor_id=p_actor_id and o.operation='influencer-'||p_kind and o.request_id=p_request_id for update;
  if v_op.payload_hash<>p_payload_hash then perform private.raise_api_error('IDEMPOTENCY_CONFLICT'); end if;
  if v_inserted=0 and v_op.state='succeeded' then return jsonb_build_object('state','succeeded','cachedResult',v_op.result); end if;
  if v_inserted=0 and v_op.state='processing' and v_op.lease_until>clock_timestamp() then perform private.raise_api_error('REQUEST_IN_PROGRESS',jsonb_build_object('retryAfterMs',ceil(extract(epoch from(v_op.lease_until-clock_timestamp()))*1000)::integer)); end if;
  update private.operations set state='processing',result=null,lease_token=v_token,lease_until=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp()
    where actor_id=p_actor_id and operation='influencer-'||p_kind and request_id=p_request_id;
  select * into v_settings from private.room_settings s where s.room_id=p_room_id;
  return jsonb_build_object('state','processing','leaseToken',v_token,'filterVersion',coalesce(v_settings.version,1));
end;
$function$;

create or replace function public.submit_influencer_message(
  p_actor_id uuid,p_room_id uuid,p_request_id uuid,p_kind text,p_payload_hash text,p_lease_token uuid,
  p_reply_to bigint,p_expected_cluster_id uuid,p_expected_cluster_version integer,p_body text,
  p_verdict text,p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_op private.operations%rowtype; v_time timestamptz; v_message_id bigint; v_name text; v_reply_context text;
  v_result jsonb; v_expected_hash text; v_cluster_id uuid;
begin
  if p_kind not in ('answer','broadcast') or p_actor_id is null or p_room_id is null or p_request_id is null or p_lease_token is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  v_expected_hash:=private.hash_payload(jsonb_build_object('roomId',p_room_id,'kind',p_kind,'replyTo',p_reply_to::text,'expectedClusterId',p_expected_cluster_id,'expectedClusterVersion',p_expected_cluster_version,'body',btrim(p_body)));
  if p_payload_hash<>v_expected_hash or char_length(btrim(p_body)) not between 1 and 2000 then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if p_verdict not in ('pass','block') then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
  if p_verdict='block' and p_category not in ('threat','stalking','sexual_harassment','privacy','hate','illegal_ad','spam') then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
  select * into v_op from private.operations o where o.actor_id=p_actor_id and o.operation='influencer-'||p_kind and o.request_id=p_request_id for update;
  if not found or v_op.payload_hash<>p_payload_hash then perform private.raise_api_error('IDEMPOTENCY_CONFLICT'); end if;
  if v_op.state='succeeded' then return coalesce(v_op.result,'{}'::jsonb); end if;
  if v_op.state<>'processing' or v_op.lease_token<>p_lease_token or v_op.lease_until<=clock_timestamp() then perform private.raise_api_error('REQUEST_IN_PROGRESS'); end if;
  if p_verdict='block' then
    v_result:=jsonb_build_object('ok',false,'error',jsonb_build_object('code','MESSAGE_BLOCKED','message',private.filter_reason(p_category),'retryable',false,'details',jsonb_build_object('category',p_category,'reason',private.filter_reason(p_category))));
    update private.operations set state='succeeded',result=v_result,lease_token=null,lease_until=null,updated_at=clock_timestamp() where actor_id=p_actor_id and operation='influencer-'||p_kind and request_id=p_request_id;
    insert into private.moderation_events(actor_id,room_id,request_id,verdict,category) values(p_actor_id,p_room_id,p_request_id,'block',p_category) on conflict do nothing;
    return v_result;
  end if;
  if (p_kind='broadcast' and (p_reply_to is not null or p_expected_cluster_id is not null or p_expected_cluster_version is not null))
     or (p_kind='answer' and p_reply_to is null) then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  perform private.lock_room(p_room_id);
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_kind='answer' then
    select m.cluster_id into v_cluster_id from public.messages m where m.id=p_reply_to and m.room_id=p_room_id and m.message_kind='user_question' and m.passes_all_filters is not null;
    if not found then perform private.raise_api_error('SOURCE_CHANGED'); end if;
    if p_expected_cluster_id is null then
      if v_cluster_id is not null or p_expected_cluster_version is not null then perform private.raise_api_error('SOURCE_CHANGED'); end if;
      if exists(select 1 from private.answer_question_links l join public.messages a on a.id=l.answer_id where l.question_id=p_reply_to and a.deleted_at is null) then perform private.raise_api_error('ALREADY_REPLIED'); end if;
    else
      if v_cluster_id<>p_expected_cluster_id or not exists(select 1 from public.message_clusters c where c.id=p_expected_cluster_id and c.room_id=p_room_id and c.version=p_expected_cluster_version) then perform private.raise_api_error('SOURCE_CHANGED'); end if;
      if exists(select 1 from public.messages q join private.answer_question_links l on l.question_id=q.id join public.messages a on a.id=l.answer_id where q.cluster_id=p_expected_cluster_id and a.deleted_at is null) then perform private.raise_api_error('ALREADY_REPLIED'); end if;
    end if;
  end if;
  v_time:=private.next_room_write_time(p_room_id);
  select i.name into v_name from public.chat_rooms r join public.influencers i on i.id=r.influencer_id where r.id=p_room_id;
  if p_kind='answer' then
    if p_expected_cluster_id is null then
      select case when q.passes_all_filters then q.body else null end into v_reply_context from public.messages q where q.id=p_reply_to;
    else
      select case when bool_and(q.passes_all_filters) then c.representative else null end into v_reply_context
      from public.message_clusters c join public.messages q on q.cluster_id=c.id where c.id=p_expected_cluster_id group by c.representative;
    end if;
  end if;
  insert into public.messages(id_text,room_id,sender_id,sender_type,message_kind,sender_name,reply_to,reply_context,body,created_at,updated_at)
  values('0',p_room_id,p_actor_id,'influencer',case when p_kind='answer' then 'influencer_answer' else 'influencer_broadcast' end,v_name,p_reply_to,v_reply_context,btrim(p_body),v_time,v_time)
  returning id into v_message_id;
  update public.messages set id_text=id::text where id=v_message_id;
  if p_kind='answer' then
    if p_expected_cluster_id is null then
      insert into private.answer_question_links(answer_id,question_id,room_id) values(v_message_id,p_reply_to,p_room_id);
    else
      insert into private.answer_question_links(answer_id,question_id,room_id)
      select v_message_id,q.id,p_room_id from public.messages q where q.room_id=p_room_id and q.cluster_id=p_expected_cluster_id and q.message_kind='user_question';
      update public.message_clusters set version=version+1,updated_at=v_time where id=p_expected_cluster_id;
    end if;
  end if;
  v_result:=jsonb_build_object('ok',true,'data',private.message_json(v_message_id,p_actor_id));
  update private.operations set state='succeeded',result=v_result,lease_token=null,lease_until=null,updated_at=clock_timestamp() where actor_id=p_actor_id and operation='influencer-'||p_kind and request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.update_room_greeting(
  p_actor_id uuid,p_room_id uuid,p_request_id uuid,p_payload_hash text,p_lease_token uuid,p_expected_version integer,
  p_body text,p_verdict text,p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_op private.operations%rowtype; v_settings private.room_settings%rowtype; v_name text; v_result jsonb; v_hash text;
begin
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  if char_length(coalesce(p_body,''))>200 or p_verdict not in ('pass','block') then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  v_hash:=private.hash_payload(jsonb_build_object('roomId',p_room_id,'expectedVersion',p_expected_version,'text',coalesce(p_body,'')));
  if v_hash<>p_payload_hash then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  select * into v_op from private.operations o where o.actor_id=p_actor_id and o.operation='influencer-greeting' and o.request_id=p_request_id for update;
  if not found or v_op.payload_hash<>p_payload_hash then perform private.raise_api_error('IDEMPOTENCY_CONFLICT'); end if;
  if v_op.state='succeeded' then return coalesce(v_op.result,'{}'::jsonb); end if;
  if v_op.state<>'processing' or v_op.lease_token<>p_lease_token or v_op.lease_until<=clock_timestamp() then perform private.raise_api_error('REQUEST_IN_PROGRESS'); end if;
  if p_verdict='block' then
    if p_category not in ('threat','stalking','sexual_harassment','privacy','hate','illegal_ad','spam') then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
    v_result:=jsonb_build_object('ok',false,'error',jsonb_build_object('code','MESSAGE_BLOCKED','message',private.filter_reason(p_category),'retryable',false,'details',jsonb_build_object('category',p_category,'reason',private.filter_reason(p_category))));
    update private.operations set state='succeeded',result=v_result,lease_token=null,lease_until=null,updated_at=clock_timestamp() where actor_id=p_actor_id and operation='influencer-greeting' and request_id=p_request_id;
    insert into private.moderation_events(actor_id,room_id,request_id,verdict,category) values(p_actor_id,p_room_id,p_request_id,'block',p_category) on conflict do nothing;
    return v_result;
  end if;
  perform private.lock_room(p_room_id);
  insert into private.room_settings(room_id) values(p_room_id) on conflict do nothing;
  select * into v_settings from private.room_settings s where s.room_id=p_room_id for update;
  if v_settings.version<>p_expected_version then perform private.raise_api_error('IDEMPOTENCY_CONFLICT',jsonb_build_object('currentVersion',v_settings.version)); end if;
  update private.room_settings set greeting_text=nullif(btrim(p_body),''),version=version+1 where room_id=p_room_id returning * into v_settings;
  select i.name into v_name from public.chat_rooms r join public.influencers i on i.id=r.influencer_id where r.id=p_room_id;
  v_result:=jsonb_build_object('ok',true,'data',jsonb_build_object('roomId',p_room_id,'text',coalesce(v_settings.greeting_text,format('%s 채팅방에 오신 것을 환영합니다. 카드를 모아 찾아와 주셔서 감사합니다. 골프 이야기나 궁금한 점을 메시지로 보내 보세요.',v_name)),'isDefault',v_settings.greeting_text is null,'maxLength',200,'version',v_settings.version));
  update private.operations set state='succeeded',result=v_result,lease_token=null,lease_until=null,updated_at=clock_timestamp() where actor_id=p_actor_id and operation='influencer-greeting' and request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.get_room_inbox(p_room_id uuid,p_include_answered boolean default false,p_cursor jsonb default null,p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_revision text; v_items jsonb; v_next jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if not private.is_verified_room_owner(p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  if p_limit<1 or p_limit>100 then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if p_cursor is not null and (jsonb_typeof(p_cursor)<>'object' or p_cursor->>'revision' is null
      or p_cursor->>'priority' !~ '^-?[0-9]+(\.[0-9]+)?$' or p_cursor->>'tieMessageId' !~ '^[1-9][0-9]{0,18}$'
      or p_cursor->>'inboxKey' is null) then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  with questions as (
    select q.*,coalesce(q.cluster_id::text,'') cluster_key,
      exists(select 1 from private.answer_question_links l join public.messages a on a.id=l.answer_id where l.question_id=q.id and a.deleted_at is null) answered,
      exists(select 1 from public.room_members rm where rm.room_id=q.room_id and rm.user_id=q.sender_id and rm.status='active') active
    from public.messages q where q.room_id=p_room_id and q.message_kind='user_question' and q.body is not null and q.passes_all_filters=true
  ), revision as (
    select encode(extensions.digest(jsonb_build_object('includeAnswered',p_include_answered,'questions',
      coalesce(jsonb_agg(jsonb_build_array(q.id_text,q.cluster_key,q.answered,q.active,q.priority) order by q.id),'[]'::jsonb))::text,'sha256'),'hex') value
    from questions q
  ), candidates as (
    select 'question:'||q.id_text inbox_key,q.priority,q.id tie_id,
      (select max(a.id) from private.answer_question_links l join public.messages a on a.id=l.answer_id where l.question_id=q.id and a.deleted_at is null) reply_id,
      q.answered,null::uuid cluster_id,null::integer cluster_version,
      private.message_json(q.id,v_actor) question_json,null::text representative,1 member_count,array[q.id_text] message_ids
    from questions q where q.cluster_id is null and q.active and (p_include_answered or not q.answered)
    union all
    select 'cluster:'||c.id::text,max(q.priority),max(q.id),
      max(a.id),
      bool_and(q.answered),c.id,c.version,null::jsonb,c.representative,count(distinct q.sender_id)::integer,array_agg(q.id_text order by q.id)
    from public.message_clusters c join questions q on q.cluster_id=c.id and q.active
    left join lateral (select max(answer.id) id from private.answer_question_links l join public.messages answer on answer.id=l.answer_id and answer.deleted_at is null where l.question_id=q.id) a on true
    where c.room_id=p_room_id and (p_include_answered or not q.answered)
    group by c.id,c.version,c.representative
  ), ordered as (
    select c.*,row_number() over(order by c.priority desc,c.tie_id desc,c.inbox_key) rn
    from candidates c cross join revision r
    where p_cursor is null or (p_cursor->>'revision'=r.value and (c.priority,c.tie_id,c.inbox_key)<((p_cursor->>'priority')::numeric,(p_cursor->>'tieMessageId')::bigint,p_cursor->>'inboxKey'))
  ), page as (select * from ordered order by priority desc,tie_id desc,inbox_key limit p_limit+1)
  select r.value,
    coalesce(jsonb_agg(jsonb_build_object(
      'inboxKey',p.inbox_key,'priority',p.priority,'tieMessageId',p.tie_id::text,'replyTo',p.tie_id::text,
      'answered',p.answered,'replyId',case when p.answered then p.reply_id::text else null end,'kind',case when p.cluster_id is null then 'question' else 'cluster' end,
      'expectedClusterId',p.cluster_id,'expectedClusterVersion',p.cluster_version,'question',p.question_json,
      'clusterId',p.cluster_id,'representative',p.representative,'memberCount',p.member_count,'activeMessageIds',p.message_ids
    ) order by p.priority desc,p.tie_id desc,p.inbox_key) filter(where p.rn<=p_limit),'[]'::jsonb),
    case when count(p.rn)>p_limit then jsonb_build_object('revision',r.value,'priority',max(p.priority) filter(where p.rn=p_limit),'tieMessageId',max(p.tie_id) filter(where p.rn=p_limit)::text,'inboxKey',max(p.inbox_key) filter(where p.rn=p_limit)) else null end
  into v_revision,v_items,v_next from revision r left join page p on true group by r.value;
  if p_cursor is not null and p_cursor->>'revision' is distinct from v_revision then perform private.raise_api_error('SOURCE_CHANGED'); end if;
  return jsonb_build_object('items',v_items,'nextCursor',v_next,'revision',v_revision);
end;
$function$;

create or replace function public.begin_room_ai_operation(p_actor_id uuid,p_room_id uuid,p_operation text,p_request_id uuid,p_payload_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_name text:='room-ai-'||p_operation; v_op private.operations%rowtype; v_token uuid:=gen_random_uuid(); v_inserted integer;
  v_room_count integer; v_actor_count integer; v_now timestamptz:=clock_timestamp();
begin
  if p_actor_id is null or p_room_id is null or p_request_id is null or p_payload_hash is null or p_operation not in ('summary','cluster') then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  insert into private.operations(actor_id,operation,request_id,payload_hash,state,lease_token,lease_until)
  values(p_actor_id,v_name,p_request_id,p_payload_hash,'processing',v_token,v_now+interval '29 seconds') on conflict do nothing;
  get diagnostics v_inserted=row_count;
  select * into v_op from private.operations o where o.actor_id=p_actor_id and o.operation=v_name and o.request_id=p_request_id for update;
  if v_op.payload_hash<>p_payload_hash then perform private.raise_api_error('IDEMPOTENCY_CONFLICT'); end if;
  if v_inserted=0 and v_op.state='succeeded' then return jsonb_build_object('state','succeeded','cachedResult',v_op.result); end if;
  if v_inserted=0 and v_op.state='processing' and v_op.lease_until>v_now then perform private.raise_api_error('REQUEST_IN_PROGRESS',jsonb_build_object('retryAfterMs',greatest(100,ceil(extract(epoch from(v_op.lease_until-v_now))*1000)::integer))); end if;
  if v_inserted=1 then
    select coalesce(sum(r.count) filter(where r.window_start>=v_now-interval '1 minute'),0)::integer into v_room_count from private.rate_windows r where r.actor_id=p_actor_id and r.operation='room-ai-room' and r.scope_id=p_room_id;
    select coalesce(sum(r.count) filter(where r.window_start>=v_now-interval '1 minute'),0)::integer into v_actor_count from private.rate_windows r where r.actor_id=p_actor_id and r.operation='room-ai-actor' and r.scope_id=p_actor_id;
    if v_room_count>=1 or v_actor_count>=3 then
      update private.operations set state='succeeded',result=jsonb_build_object('error','RATE_LIMITED','retryAfterSeconds',60),lease_token=null,lease_until=null,updated_at=v_now where actor_id=p_actor_id and operation=v_name and request_id=p_request_id;
      return jsonb_build_object('state','succeeded','cachedResult',jsonb_build_object('error','RATE_LIMITED','retryAfterSeconds',60));
    end if;
    insert into private.rate_windows(actor_id,operation,scope_id,window_start,count) values
      (p_actor_id,'room-ai-room',p_room_id,date_trunc('second',v_now),1),
      (p_actor_id,'room-ai-actor',p_actor_id,date_trunc('second',v_now),1)
    on conflict(actor_id,operation,scope_id,window_start) do update set count=private.rate_windows.count+1;
  end if;
  update private.operations set state='processing',result=null,lease_token=v_token,lease_until=v_now+interval '29 seconds',updated_at=v_now where actor_id=p_actor_id and operation=v_name and request_id=p_request_id;
  return jsonb_build_object('state','processing','leaseToken',v_token);
end;
$function$;

create or replace function public.get_room_ai_source(p_actor_id uuid,p_room_id uuid,p_operation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_items jsonb; v_ids jsonb;
begin
  if p_operation not in ('summary','cluster') or not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('NOT_FOUND'); end if;
  if p_operation='summary' then
    with candidates as (
      select m.id,m.id_text,m.body,m.sender_name,m.message_kind
      from public.messages m where m.room_id=p_room_id and m.body is not null and m.deleted_at is null
        and (m.message_kind='influencer_answer' or m.message_kind='influencer_broadcast' or (m.message_kind='user_question' and m.passes_all_filters=true))
      order by m.id desc limit 100
    ), sized as (
      select c.*,sum(char_length(c.body)) over(order by c.id desc) total_chars from candidates c
    ), selected as (select * from sized where total_chars<=20000)
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id_text,'body',s.body,'sender',s.sender_name) order by s.id),'[]'::jsonb),
      coalesce(jsonb_agg(s.id_text order by s.id),'[]'::jsonb)
      into v_items,v_ids from selected s;
  else
    with candidates as (
      select m.id,m.id_text,m.body,m.sender_name from public.messages m
      where m.room_id=p_room_id and m.message_kind='user_question' and m.body is not null and m.deleted_at is null and m.passes_all_filters=true
        and not exists(select 1 from private.answer_question_links l join public.messages a on a.id=l.answer_id where l.question_id=m.id and a.deleted_at is null)
      order by m.id desc limit 100
    ), sized as (
      select c.*,sum(char_length(c.body)) over(order by c.id desc) total_chars from candidates c
    ), selected as (select * from sized where total_chars<=20000)
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id_text,'body',s.body,'sender',s.sender_name) order by s.id),'[]'::jsonb),
      coalesce(jsonb_agg(s.id_text order by s.id),'[]'::jsonb)
      into v_items,v_ids from selected s;
  end if;
  return jsonb_build_object('items',v_items,'sourceMessageIds',v_ids);
end;
$function$;

create or replace function public.finish_room_ai_operation(
  p_actor_id uuid,p_room_id uuid,p_operation text,p_request_id uuid,p_payload_hash text,p_lease_token uuid,
  p_source_message_ids bigint[],p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_name text:='room-ai-'||p_operation; v_op private.operations%rowtype; v_time timestamptz:=clock_timestamp();
  v_cluster jsonb; v_ids text[]; v_count integer; v_rep text; v_cluster_id uuid; v_used text[]:='{}'::text[]; v_out jsonb:='[]'::jsonb;
  v_source_count integer;
begin
  if p_operation not in ('summary','cluster') or p_actor_id is null or p_room_id is null or p_request_id is null or p_lease_token is null or p_source_message_ids is null then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('FORBIDDEN'); end if;
  select * into v_op from private.operations o where o.actor_id=p_actor_id and o.operation=v_name and o.request_id=p_request_id for update;
  if not found or v_op.payload_hash<>p_payload_hash then perform private.raise_api_error('IDEMPOTENCY_CONFLICT'); end if;
  if v_op.state='succeeded' then return coalesce(v_op.result,'{}'::jsonb); end if;
  if v_op.state<>'processing' or v_op.lease_token<>p_lease_token or v_op.lease_until<=clock_timestamp() then perform private.raise_api_error('REQUEST_IN_PROGRESS'); end if;
  if p_operation='summary' then
    if jsonb_typeof(p_result->'summary')<>'string' or char_length(p_result->>'summary')>2000 then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
    select count(*) into v_source_count from public.messages m where m.room_id=p_room_id and m.id=any(p_source_message_ids)
      and m.body is not null and m.deleted_at is null and (m.message_kind in ('influencer_answer','influencer_broadcast') or (m.message_kind='user_question' and m.passes_all_filters=true));
    if v_source_count<>cardinality(p_source_message_ids) then perform private.raise_api_error('SOURCE_CHANGED'); end if;
    p_result:=jsonb_build_object('roomId',p_room_id,'summary',p_result->>'summary','sourceMessageIds',to_jsonb(p_source_message_ids::text[]),'generatedAt',v_time);
  else
    if jsonb_typeof(p_result->'clusters')<>'array' then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
    select count(*) into v_source_count from public.messages m where m.room_id=p_room_id and m.id=any(p_source_message_ids)
      and m.message_kind='user_question' and m.body is not null and m.deleted_at is null and m.passes_all_filters=true
      and not exists(select 1 from private.answer_question_links l join public.messages a on a.id=l.answer_id where l.question_id=m.id and a.deleted_at is null);
    if v_source_count<>cardinality(p_source_message_ids) then perform private.raise_api_error('SOURCE_CHANGED'); end if;
    perform private.lock_room(p_room_id);
    update public.messages set cluster_id=null where room_id=p_room_id and id=any(p_source_message_ids) and message_kind='user_question';
    for v_cluster in select value from jsonb_array_elements(p_result->'clusters') loop
      if jsonb_typeof(v_cluster->'messageIds')<>'array' or jsonb_array_length(v_cluster->'messageIds')<2 then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
      v_rep:=v_cluster->>'representative';
      if char_length(v_rep) not between 1 and 200 then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
      select array_agg(value) into v_ids from jsonb_array_elements_text(v_cluster->'messageIds') x(value);
      if cardinality(v_ids)<>jsonb_array_length(v_cluster->'messageIds') or exists(select 1 from unnest(v_ids) x where x !~ '^[1-9][0-9]{0,18}$' or not (x::bigint=any(p_source_message_ids))) then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
      if exists(select 1 from unnest(v_ids) x where x=any(v_used)) then perform private.raise_api_error('FILTER_UNAVAILABLE'); end if;
      v_used:=v_used||v_ids;
      insert into public.message_clusters(room_id,representative,version,created_at,updated_at) values(p_room_id,v_rep,1,v_time,v_time) returning id into v_cluster_id;
      update public.messages set cluster_id=v_cluster_id where room_id=p_room_id and id=any(v_ids::bigint[]);
      select count(distinct q.sender_id)::integer into v_count from public.messages q join public.room_members rm on rm.room_id=q.room_id and rm.user_id=q.sender_id and rm.status='active' where q.id=any(v_ids::bigint[]);
      v_out:=v_out||jsonb_build_array(jsonb_build_object('id',v_cluster_id,'representative',v_rep,'memberCount',v_count,'messageIds',v_ids));
    end loop;
    p_result:=jsonb_build_object('roomId',p_room_id,'clusters',v_out);
  end if;
  update private.operations set state='succeeded',result=p_result,lease_token=null,lease_until=null,updated_at=v_time where actor_id=p_actor_id and operation=v_name and request_id=p_request_id;
  return p_result;
end;
$function$;

create or replace function public.fail_room_ai_operation(p_actor_id uuid,p_room_id uuid,p_operation text,p_request_id uuid,p_lease_token uuid,p_error_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_updated integer; v_name text:='room-ai-'||p_operation;
begin
  if p_operation not in ('summary','cluster') or p_error_code not in ('FILTER_UNAVAILABLE','INTERNAL_ERROR','NETWORK_ERROR','SOURCE_CHANGED') then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  if not private.actor_owns_verified_room(p_actor_id,p_room_id) then perform private.raise_api_error('FORBIDDEN'); end if;
  update private.operations set state='failed',result=jsonb_build_object('error',p_error_code),lease_token=null,lease_until=null,updated_at=clock_timestamp()
   where actor_id=p_actor_id and operation=v_name and request_id=p_request_id and state='processing' and lease_token=p_lease_token;
  get diagnostics v_updated=row_count;
  return jsonb_build_object('updated',v_updated=1);
end;
$function$;

revoke all on function private.actor_owns_verified_room(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.get_room_daily_block_count(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_my_influencer_profile() from public,anon,authenticated,service_role;
revoke all on function public.get_room_filters(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_room_greeting(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_room_daily_block_count(uuid) from public,anon,authenticated,service_role;
revoke all on function public.update_room_filters(uuid,uuid,text[],integer) from public,anon,authenticated,service_role;
revoke all on function public.update_game_config(uuid,text,jsonb,integer) from public,anon,authenticated,service_role;
revoke all on function public.request_verification(uuid,public.influencer_type,text) from public,anon,authenticated,service_role;
revoke all on function public.approve_verification(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.begin_influencer_message_submission(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.submit_influencer_message(uuid,uuid,uuid,text,text,uuid,bigint,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.update_room_greeting(uuid,uuid,uuid,text,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.get_room_inbox(uuid,boolean,jsonb,integer) from public,anon,authenticated,service_role;
revoke all on function public.begin_room_ai_operation(uuid,uuid,text,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.get_room_ai_source(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.finish_room_ai_operation(uuid,uuid,text,uuid,text,uuid,bigint[],jsonb) from public,anon,authenticated,service_role;
revoke all on function public.fail_room_ai_operation(uuid,uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_my_influencer_profile() to authenticated;
grant execute on function public.get_room_filters(uuid) to authenticated;
grant execute on function public.get_room_greeting(uuid) to authenticated;
grant execute on function public.get_room_daily_block_count(uuid) to authenticated;
grant execute on function public.update_room_filters(uuid,uuid,text[],integer) to authenticated;
grant execute on function public.update_game_config(uuid,text,jsonb,integer) to authenticated;
grant execute on function public.request_verification(uuid,public.influencer_type,text) to authenticated;
grant execute on function public.approve_verification(uuid,uuid,text,text) to authenticated;
grant execute on function public.begin_influencer_message_submission(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.submit_influencer_message(uuid,uuid,uuid,text,text,uuid,bigint,uuid,integer,text,text,text) to service_role;
grant execute on function public.update_room_greeting(uuid,uuid,uuid,text,uuid,integer,text,text,text) to service_role;
grant execute on function public.get_room_inbox(uuid,boolean,jsonb,integer) to authenticated;
grant execute on function public.begin_room_ai_operation(uuid,uuid,text,uuid,text) to service_role;
grant execute on function public.get_room_ai_source(uuid,uuid,text) to service_role;
grant execute on function public.finish_room_ai_operation(uuid,uuid,text,uuid,text,uuid,bigint[],jsonb) to service_role;
grant execute on function public.fail_room_ai_operation(uuid,uuid,text,uuid,uuid,text) to service_role;
