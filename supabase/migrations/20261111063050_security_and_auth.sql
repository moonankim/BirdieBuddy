create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_nickname text;
begin
  v_nickname := nullif(btrim(new.raw_user_meta_data ->> 'nickname'), '');
  if v_nickname is null or char_length(v_nickname) > 30 then
    v_nickname := '버디';
  end if;
  insert into public.profiles (id, nickname, role)
  values (new.id, v_nickname, 'user')
  on conflict (id) do nothing;
  return new;
end;
$function$;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated, service_role;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $function$
  select p.role from public.profiles p where p.id = auth.uid()
$function$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(private.current_role() = 'admin'::public.user_role, false)
$function$;

create or replace function private.is_my_influencer(p_influencer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from private.influencer_accounts ia
    where ia.influencer_id = p_influencer_id and ia.user_id = auth.uid()
  )
$function$;

create or replace function private.is_room_owner(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.chat_rooms r
    join private.influencer_accounts ia on ia.influencer_id = r.influencer_id
    where r.id = p_room_id and ia.user_id = auth.uid()
  )
$function$;

create or replace function private.is_verified_room_owner(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.chat_rooms r
    join public.influencers i on i.id = r.influencer_id
    join private.influencer_accounts ia on ia.influencer_id = i.id
    where r.id = p_room_id and ia.user_id = auth.uid() and i.verified_at is not null
  )
$function$;

create or replace function private.current_month_for_actor()
returns date
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month date;
begin
  if auth.uid() is null then
    return null;
  end if;
  if exists (select 1 from private.demo_accounts d where d.user_id = auth.uid()) then
    select c.current_month into v_month from private.demo_clock c where c.id = 'hackathon';
    if v_month is not null then return v_month; end if;
  end if;
  return date_trunc('month', statement_timestamp() at time zone 'Asia/Seoul')::date;
end;
$function$;

create or replace function private.is_active_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = p_user_id and rm.status = 'active'
  )
$function$;

create or replace function private.was_member_at(p_room_id uuid, p_user_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from private.room_member_periods p
    where p.room_id = p_room_id and p.user_id = p_user_id
      and p.joined_at <= p_at and (p.left_at is null or p_at < p.left_at)
  )
$function$;

create or replace function private.can_read_message(
  p_message_id bigint,
  p_room_id uuid,
  p_sender_id uuid,
  p_sender_type text,
  p_message_kind text,
  p_recipient_user_id uuid,
  p_created_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;
  if private.is_room_owner(p_room_id) then return true; end if;
  if private.current_role() <> 'user'::public.user_role or not private.is_active_member(p_room_id, v_user) then
    return false;
  end if;
  if p_sender_type = 'user' then
    return p_message_kind = 'user_question' and p_sender_id = v_user
      and private.was_member_at(p_room_id, v_user, p_created_at);
  end if;
  if p_message_kind = 'greeting' then
    return p_recipient_user_id = v_user and private.was_member_at(p_room_id, v_user, p_created_at);
  end if;
  if p_message_kind = 'influencer_answer' and exists (
    select 1
    from private.answer_question_links l
    join public.messages q on q.id = l.question_id
    where l.room_id = p_room_id and l.answer_id = p_message_id
      and q.sender_id = v_user and q.message_kind = 'user_question'
  ) then
    return true;
  end if;
  return p_message_kind in ('influencer_answer', 'influencer_broadcast')
    and private.was_member_at(p_room_id, v_user, p_created_at);
end;
$function$;

create or replace function private.set_message_text_ids()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.id_text := new.id::text;
  new.reply_to_text := new.reply_to::text;
  return new;
end;
$function$;

create trigger messages_text_ids_before_write
  before insert or update of id, reply_to on public.messages
  for each row execute function private.set_message_text_ids();

revoke all on function private.current_role() from public, anon, authenticated, service_role;
revoke all on function private.is_admin() from public, anon, authenticated, service_role;
revoke all on function private.is_my_influencer(uuid) from public, anon, authenticated, service_role;
revoke all on function private.is_room_owner(uuid) from public, anon, authenticated, service_role;
revoke all on function private.is_verified_room_owner(uuid) from public, anon, authenticated, service_role;
revoke all on function private.current_month_for_actor() from public, anon, authenticated, service_role;
revoke all on function private.is_active_member(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.was_member_at(uuid, uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.can_read_message(bigint, uuid, uuid, text, text, uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.set_message_text_ids() from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_my_influencer(uuid) to authenticated;
grant execute on function private.is_room_owner(uuid) to authenticated;
grant execute on function private.is_verified_room_owner(uuid) to authenticated;
grant execute on function private.current_month_for_actor() to authenticated;
grant execute on function private.is_active_member(uuid, uuid) to authenticated;
grant execute on function private.was_member_at(uuid, uuid, timestamptz) to authenticated;
grant execute on function private.can_read_message(bigint, uuid, uuid, text, text, uuid, timestamptz) to authenticated;

do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'influencers', 'card_templates', 'user_cards', 'rounds', 'draws',
    'chat_rooms', 'room_members', 'messages', 'message_clusters', 'verifications', 'game_config'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', v_table);
  end loop;
end;
$block$;

grant select on public.profiles to authenticated;
grant select on public.influencers to authenticated;
grant select on public.card_templates to authenticated;
grant select on public.user_cards to authenticated;
grant select on public.rounds to authenticated;
grant select on public.draws to authenticated;
grant select on public.chat_rooms to authenticated;
grant select on public.room_members to authenticated;
grant select (
  id_text, room_id, sender_id, sender_type, message_kind, recipient_user_id, sender_name,
  reply_to_text, reply_context, body, deleted_at, passes_all_filters, support_badge,
  own_score, quality_score, priority, cluster_id, created_at, updated_at
) on public.messages to authenticated;
grant select on public.message_clusters to authenticated;
grant select on public.verifications to authenticated;
grant select on public.game_config to authenticated;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy influencers_select_verified_or_self on public.influencers
  for select to authenticated using (verified_at is not null or private.is_my_influencer(id));

create policy card_templates_select_authenticated on public.card_templates
  for select to authenticated using (true);

create policy user_cards_select_self on public.user_cards
  for select to authenticated using (user_id = (select auth.uid()));

create policy rounds_select_self on public.rounds
  for select to authenticated using (user_id = (select auth.uid()));

create policy draws_select_self on public.draws
  for select to authenticated using (user_id = (select auth.uid()));

create policy chat_rooms_select_verified on public.chat_rooms
  for select to authenticated using (
    exists (select 1 from public.influencers i where i.id = influencer_id and i.verified_at is not null)
  );

create policy room_members_select_self_or_owner on public.room_members
  for select to authenticated using (
    user_id = (select auth.uid()) or private.is_room_owner(room_id)
  );

create policy messages_select_visible on public.messages
  for select to authenticated using (
    private.can_read_message(id, room_id, sender_id, sender_type, message_kind, recipient_user_id, created_at)
  );

create policy message_clusters_select_room_owner on public.message_clusters
  for select to authenticated using (private.is_room_owner(room_id));

create policy verifications_select_owner_or_admin on public.verifications
  for select to authenticated using (private.is_my_influencer(influencer_id) or private.is_admin());

create policy game_config_select_authenticated on public.game_config
  for select to authenticated using (true);
