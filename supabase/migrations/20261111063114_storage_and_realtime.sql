create policy card_assets_public_read on storage.objects
  for select to public using (bucket_id='card-assets');
create policy card_assets_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id='card-assets' and private.is_admin());
create policy card_assets_admin_update on storage.objects
  for update to authenticated using (bucket_id='card-assets' and private.is_admin())
  with check (bucket_id='card-assets' and private.is_admin());
create policy card_assets_admin_delete on storage.objects
  for delete to authenticated using (bucket_id='card-assets' and private.is_admin());

create policy influencer_profiles_public_read on storage.objects
  for select to public using (bucket_id='influencer-profiles');
create policy influencer_profiles_owner_insert on storage.objects
  for insert to authenticated with check (
    bucket_id='influencer-profiles'
    and case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$' then
      private.is_my_influencer(split_part(name,'/',1)::uuid)
      and exists(select 1 from public.influencers i where i.id=split_part(name,'/',1)::uuid and i.verified_at is not null)
    else false end
  );

create or replace function private.create_first_greeting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_room public.chat_rooms%rowtype; v_influencer public.influencers%rowtype; v_sender uuid; v_body text; v_time timestamptz;
begin
  if exists(select 1 from public.messages m where m.room_id=new.room_id and m.recipient_user_id=new.user_id and m.message_kind='greeting') then return new; end if;
  select r.* into v_room from public.chat_rooms r where r.id=new.room_id;
  select i.* into v_influencer from public.influencers i where i.id=v_room.influencer_id;
  select a.user_id into v_sender from private.influencer_accounts a where a.influencer_id=v_influencer.id;
  if v_sender is null then return new; end if;
  select s.greeting_text into v_body from private.room_settings s where s.room_id=new.room_id;
  v_body:=coalesce(v_body,format('%s 채팅방에 오신 것을 환영합니다. 카드를 모아 찾아와 주셔서 감사합니다. 골프 이야기나 궁금한 점을 메시지로 보내 보세요.',v_influencer.name));
  v_time:=new.joined_at;
  insert into public.messages(id_text,room_id,sender_id,sender_type,message_kind,recipient_user_id,sender_name,body,created_at,updated_at)
  values('0',new.room_id,v_sender,'influencer','greeting',new.user_id,v_influencer.name,v_body,v_time,v_time);
  return new;
end;
$function$;
create trigger room_member_period_first_greeting
  after insert on private.room_member_periods
  for each row execute function private.create_first_greeting();

create or replace function public.set_influencer_profile_photo(
  p_request_id uuid,p_profile_image_path text,p_content_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid:=auth.uid(); v_influencer uuid; v_room uuid; v_hash text; v_cached jsonb; v_result jsonb;
  v_object jsonb;
begin
  if v_actor is null then perform private.raise_api_error('UNAUTHENTICATED'); end if;
  if p_request_id is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  select a.influencer_id into v_influencer from private.influencer_accounts a
    join public.influencers i on i.id=a.influencer_id and i.verified_at is not null where a.user_id=v_actor;
  if v_influencer is null then perform private.raise_api_error('FORBIDDEN'); end if;
  if p_profile_image_path !~ ('^'||v_influencer::text||'/'||p_request_id::text||'\.webp$') then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  v_hash:=private.hash_payload(jsonb_build_object('profileImagePath',p_profile_image_path,'contentSha256',p_content_sha256));
  v_cached:=private.reserve_simple_operation(v_actor,'set-influencer-profile-photo',p_request_id,v_hash);
  if v_cached is not null then return v_cached; end if;
  select jsonb_build_object('id',o.id,'bucket_id',o.bucket_id,'name',o.name,'metadata',o.metadata) into v_object
    from storage.objects o where o.bucket_id='influencer-profiles' and o.name=p_profile_image_path;
  if v_object is null then perform private.raise_api_error('NOT_FOUND'); end if;
  if coalesce(v_object->'metadata'->>'mimetype','')<>'image/webp' then perform private.raise_api_error('VALIDATION_ERROR'); end if;
  update public.influencers set profile_image_path=p_profile_image_path where id=v_influencer;
  select r.id into v_room from public.chat_rooms r where r.influencer_id=v_influencer;
  v_result:=jsonb_build_object('influencerId',v_influencer,'profileImagePath',p_profile_image_path,'roomId',v_room);
  perform private.finish_simple_operation(v_actor,'set-influencer-profile-photo',p_request_id,v_result);
  return v_result;
end;
$function$;

revoke all on function private.create_first_greeting() from public,anon,authenticated,service_role;
revoke all on function public.set_influencer_profile_photo(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_influencer_profile_photo(uuid,text,text) to authenticated;
grant execute on function private.get_room_daily_block_count(uuid,uuid) to authenticated;

create or replace function public.cleanup_backend_metadata()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_suggestions integer; v_events integer; v_operations integer; v_windows integer;
begin
  delete from private.moderation_suggestions where expires_at<clock_timestamp(); get diagnostics v_suggestions=row_count;
  delete from private.moderation_events where created_at<clock_timestamp()-interval '7 days'; get diagnostics v_events=row_count;
  delete from private.operations where updated_at<clock_timestamp()-interval '7 days'
    and (state<>'processing' or lease_until is null or lease_until<=clock_timestamp()); get diagnostics v_operations=row_count;
  delete from private.rate_windows where window_start<clock_timestamp()-interval '7 days'; get diagnostics v_windows=row_count;
  return jsonb_build_object('suggestions',v_suggestions,'moderationEvents',v_events,'operations',v_operations,'rateWindows',v_windows);
end;
$function$;
revoke all on function public.cleanup_backend_metadata() from public,anon,authenticated,service_role;
grant execute on function public.cleanup_backend_metadata() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('birdiebuddy-retention-daily','0 3 * * *','select public.cleanup_backend_metadata();');
