begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Every identity, period, message and cursor is rolled back with this test.
create temporary table read_state_ctx as
select gen_random_uuid() fan_a, gen_random_uuid() fan_b,
  gen_random_uuid() outsider, gen_random_uuid() owner_a,
  gen_random_uuid() owner_b, gen_random_uuid() admin_id,
  gen_random_uuid() influencer_a, gen_random_uuid() influencer_b,
  gen_random_uuid() room_a, gen_random_uuid() room_b, gen_random_uuid() cluster_id;
create temporary table read_state_messages (name text primary key, id bigint not null);
create temporary table read_state_pages (name text primary key, page jsonb not null);
grant select on read_state_ctx, read_state_messages to authenticated, anon;
grant select, insert on read_state_pages to authenticated;

do $$
declare c read_state_ctx%rowtype;
begin
  select * into c from read_state_ctx;
  insert into auth.users (id, email)
  select id, id || '@read-state.test'
  from unnest(array[c.fan_a,c.fan_b,c.outsider,c.owner_a,c.owner_b,c.admin_id]) ids(id);
  update public.profiles set role='influencer' where id in (c.owner_a,c.owner_b);
  update public.profiles set role='admin' where id=c.admin_id;
  insert into public.influencers(id,name,type,verified_at) values
    (c.influencer_a,'Read state owner A','tour',now()),
    (c.influencer_b,'Read state owner B','tour',now());
  insert into private.influencer_accounts(user_id,influencer_id) values
    (c.owner_a,c.influencer_a),(c.owner_b,c.influencer_b);
  insert into public.chat_rooms(id,influencer_id) values
    (c.room_a,c.influencer_a),(c.room_b,c.influencer_b);
  insert into public.room_members(room_id,user_id,gauge,status,joined_at,joined_month) values
    (c.room_a,c.fan_a,100,'active',now()-interval '2 days',date_trunc('month',now())::date),
    (c.room_a,c.fan_b,100,'active',now()-interval '6 days',date_trunc('month',now())::date);
  insert into private.room_member_periods(room_id,user_id,joined_at,left_at) values
    (c.room_a,c.fan_a,now()-interval '6 days',now()-interval '4 days'),
    (c.room_a,c.fan_a,now()-interval '2 days',null),
    (c.room_a,c.fan_b,now()-interval '6 days',null);
  insert into public.message_clusters(id,room_id,representative)
  values(c.cluster_id,c.room_a,'Mixed old and new questions');
end;
$$;

-- Replace fixture-only auto greetings to give the history a controlled ID order.
delete from public.messages where room_id=(select room_a from read_state_ctx) and message_kind='greeting';

create function pg_temp.add_read_state_message(
  p_name text, p_sender uuid, p_kind text, p_created timestamptz,
  p_priority numeric default 50, p_recipient uuid default null,
  p_reply bigint default null, p_cluster uuid default null, p_pass boolean default true,
  p_deleted boolean default false
) returns void language plpgsql as $$
declare v_id bigint;
begin
  insert into public.messages(room_id,sender_id,sender_type,message_kind,sender_name,
    body,deleted_at,recipient_user_id,reply_to,cluster_id,passes_all_filters,
    support_badge,own_score,quality_score,priority,created_at)
  select room_a,p_sender,case when p_kind='user_question' then 'user' else 'influencer' end,
    p_kind,'Read state fixture',case when p_deleted then null else p_name end,
    case when p_deleted then p_created else null end,p_recipient,p_reply,p_cluster,
    case when p_kind='user_question' then p_pass end,
    case when p_kind='user_question' then 'none' end,
    case when p_kind='user_question' then 0 end,
    case when p_kind='user_question' then 50 end,
    case when p_kind='user_question' then p_priority end,p_created
  from read_state_ctx returning id into v_id;
  insert into read_state_messages values(p_name,v_id);
end;
$$;

do $$
declare c read_state_ctx%rowtype; v_old bigint; v_other bigint;
begin
  select * into c from read_state_ctx;
  perform pg_temp.add_read_state_message('old_question',c.fan_a,'user_question',now()-interval '5 days',95);
  select id into v_old from read_state_messages where name='old_question';
  perform pg_temp.add_read_state_message('old_broadcast',c.owner_a,'influencer_broadcast',now()-interval '5 days');
  perform pg_temp.add_read_state_message('own_question',c.fan_a,'user_question',now()-interval '1 day',90);
  perform pg_temp.add_read_state_message('other_question',c.fan_b,'user_question',now()-interval '5 days',80);
  select id into v_other from read_state_messages where name='other_question';
  perform pg_temp.add_read_state_message('own_greeting',c.owner_a,'greeting',now()-interval '1 day',p_recipient=>c.fan_a);
  perform pg_temp.add_read_state_message('other_greeting',c.owner_a,'greeting',now()-interval '1 day',p_recipient=>c.fan_b);
  perform pg_temp.add_read_state_message('gap_broadcast',c.owner_a,'influencer_broadcast',now()-interval '3 days');
  perform pg_temp.add_read_state_message('own_gap_answer',c.owner_a,'influencer_answer',now()-interval '3 days',p_reply=>v_old);
  insert into private.answer_question_links(room_id,answer_id,question_id)
  select c.room_a,id,v_old from read_state_messages where name='own_gap_answer';
  perform pg_temp.add_read_state_message('current_broadcast',c.owner_a,'influencer_broadcast',now()-interval '1 day');
  perform pg_temp.add_read_state_message('deleted_broadcast',c.owner_a,'influencer_broadcast',now()-interval '1 day',p_deleted=>true);
  perform pg_temp.add_read_state_message('other_gap_answer',c.owner_a,'influencer_answer',now()-interval '3 days',p_reply=>v_other);
  insert into private.answer_question_links(room_id,answer_id,question_id)
  select c.room_a,id,v_other from read_state_messages where name='other_gap_answer';
  perform pg_temp.add_read_state_message('filtered_question',c.fan_a,'user_question',now()-interval '1 day',p_pass=>false);
  perform pg_temp.add_read_state_message('cluster_old',c.fan_a,'user_question',now()-interval '5 days',20,p_cluster=>c.cluster_id);
  perform pg_temp.add_read_state_message('cluster_new',c.fan_b,'user_question',now()-interval '1 day',10,p_cluster=>c.cluster_id);
  perform pg_temp.add_read_state_message('latest_low_priority',c.fan_a,'user_question',now()-interval '1 day',1);
end;
$$;

select ok((select relrowsecurity from pg_class where oid='private.room_read_states'::regclass), 'room read states have RLS');
select ok((select relrowsecurity from pg_class where oid='private.inbox_read_states'::regclass), 'inbox read states have RLS');
select ok(not has_table_privilege('authenticated','private.room_read_states','SELECT'), 'fans cannot bypass RPC with direct cursor reads');
select ok(not has_table_privilege('authenticated','private.inbox_read_states','INSERT'), 'owners cannot bypass monotonic RPC with direct cursor inserts');
select ok(not has_function_privilege('anon','public.mark_room_read(uuid,text)','EXECUTE'), 'anon cannot execute room cursor mutation');
select ok(not has_function_privilege('anon','public.get_room_inbox_with_read_state(uuid,boolean,jsonb,integer)','EXECUTE'), 'anon cannot execute inbox read-state query');
select has_index('private','room_read_states','room_read_states_user_id_idx','room actor FK is indexed');
select has_index('private','room_read_states','room_read_states_room_last_read_message_idx','room message cursor FK is indexed');
select has_index('private','inbox_read_states','inbox_read_states_user_id_idx','inbox actor FK is indexed');
select has_index('private','inbox_read_states','inbox_read_states_room_last_checked_message_idx','inbox message cursor FK is indexed');

set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_room_read_state((select room_a from read_state_ctx))$$,'P0001','UNAUTHENTICATED','missing identity cannot read room state');
select throws_ok($$select public.mark_inbox_checked((select room_a from read_state_ctx),null)$$,'P0001','UNAUTHENTICATED','missing identity cannot mutate inbox state');
select set_config('request.jwt.claim.sub',(select fan_a::text from read_state_ctx),true);
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'unreadCount','0','first room visit does not label historical messages unread');
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'firstUnreadMessageId',null,'first visit has no unread divider');
select is(public.mark_room_read((select room_a from read_state_ctx),null)->>'lastReadMessageId',null,'null initializes a first-visit cursor');
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'unreadCount','4','initialized null counts visible influencer messages only');
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'firstUnreadMessageId',(select id::text from read_state_messages where name='old_broadcast'),'divider is the first visible unread influencer message');
select is(public.get_my_room_unread_counts()->0->>'unreadCount','4','room list count matches room state');
select is(jsonb_array_length(public.get_my_room_unread_counts()),1,'room counts include only this actor active memberships');
select throws_ok($$select public.mark_room_read((select room_a from read_state_ctx),(select id::text from read_state_messages where name='other_question'))$$,'P0001','FORBIDDEN','fan cannot mark another fan private question read');
select throws_ok($$select public.mark_room_read((select room_a from read_state_ctx),'0')$$,'P0001','VALIDATION_ERROR','zero message ID is invalid');
select throws_ok($$select public.mark_room_read(null,null)$$,'P0001','VALIDATION_ERROR','room ID is required');
select is(public.mark_room_read((select room_a from read_state_ctx),(select id::text from read_state_messages where name='current_broadcast'))->>'lastReadMessageId',(select id::text from read_state_messages where name='current_broadcast'),'visible message advances room cursor');
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'unreadCount','0','deleted and invisible messages after cursor remain excluded');
select is(public.mark_room_read((select room_a from read_state_ctx),(select id::text from read_state_messages where name='old_broadcast'))->>'lastReadMessageId',(select id::text from read_state_messages where name='current_broadcast'),'older room cursor cannot move backward');
select is(public.mark_room_read((select room_a from read_state_ctx),null)->>'lastReadMessageId',(select id::text from read_state_messages where name='current_broadcast'),'null replay cannot erase room cursor');
select is(public.mark_room_read((select room_a from read_state_ctx),(select id::text from read_state_messages where name='current_broadcast'))->>'lastReadMessageId',(select id::text from read_state_messages where name='current_broadcast'),'same message replay is idempotent');
select is(public.mark_room_read((select room_a from read_state_ctx),(select id::text from read_state_messages where name='own_question'))->>'lastReadMessageId',(select id::text from read_state_messages where name='current_broadcast'),'own question is an allowed visible cursor without regressing state');
select set_config('request.jwt.claim.sub',(select fan_b::text from read_state_ctx),true);
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'lastReadMessageId',null,'another fan does not inherit room cursor');
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'unreadCount','0','another fan retains first-visit behavior');
select set_config('request.jwt.claim.sub',(select outsider::text from read_state_ctx),true);
select throws_ok($$select public.get_room_read_state((select room_a from read_state_ctx))$$,'P0001','ROOM_INACTIVE','non-member cannot read room state');
select throws_ok($$select public.mark_room_read((select room_a from read_state_ctx),null)$$,'P0001','ROOM_INACTIVE','non-member cannot initialize room state');
select set_config('request.jwt.claim.sub',(select owner_a::text from read_state_ctx),true);
select throws_ok($$select public.get_room_read_state((select room_a from read_state_ctx))$$,'P0001','FORBIDDEN','influencer cannot use fan read-state API');
select is(public.get_inbox_read_state((select room_a from read_state_ctx))->>'lastCheckedMessageId',null,'owner first inbox cursor is null');
insert into read_state_pages values('initial',public.get_room_inbox_with_read_state((select room_a from read_state_ctx),false,null,1));
select is((select page->>'newCount' from read_state_pages where name='initial'),'3','NEW count excludes answered, filtered and previous-entry questions');
select is((select page #>> '{items,0,question,id}' from read_state_pages where name='initial'),(select id::text from read_state_messages where name='own_question'),'first page follows priority rather than latest ID');
select is((select page->>'checkedThroughMessageId' from read_state_pages where name='initial'),(select id::text from read_state_messages where name='latest_low_priority'),'checked-through includes low-priority questions beyond current page');
select ok((select page->'nextCursor' <> 'null'::jsonb from read_state_pages where name='initial'),'priority page provides a next cursor');
insert into read_state_pages select 'second',public.get_room_inbox_with_read_state((select room_a from read_state_ctx),false,page->'nextCursor',1) from read_state_pages where name='initial';
select is((select page->>'checkedThroughMessageId' from read_state_pages where name='second'),(select id::text from read_state_messages where name='latest_low_priority'),'checked-through is stable on later priority pages');
insert into read_state_pages values('all',public.get_room_inbox_with_read_state((select room_a from read_state_ctx),true,null,100));
select ok((select (item->>'isNew')::boolean from read_state_pages p cross join lateral jsonb_array_elements(p.page->'items') item where p.name='all' and item->>'kind'='cluster'),'cluster is NEW when at least one current-entry question is new');
select is((select item->>'isNew' from read_state_pages p cross join lateral jsonb_array_elements(p.page->'items') item where p.name='all' and item #>> '{question,id}'=(select id::text from read_state_messages where name='old_question')),'false','answered historical question is not NEW');
select is(public.mark_inbox_checked((select room_a from read_state_ctx),(select id::text from read_state_messages where name='own_question'))->>'lastCheckedMessageId',(select id::text from read_state_messages where name='own_question'),'owner can mark checked through a current-entry question');
select is(public.get_room_inbox_with_read_state((select room_a from read_state_ctx))->>'newCount','2','NEW count decreases only for questions up to cursor');
select throws_ok($$select public.mark_inbox_checked((select room_a from read_state_ctx),(select id::text from read_state_messages where name='cluster_old'))$$,'P0001','FORBIDDEN','new cursor cannot advance to an earlier membership period question');
select throws_ok($$select public.mark_inbox_checked((select room_a from read_state_ctx),(select id::text from read_state_messages where name='filtered_question'))$$,'P0001','FORBIDDEN','filtered question cannot advance inbox cursor');
select is(public.mark_inbox_checked((select room_a from read_state_ctx),(select id::text from read_state_messages where name='latest_low_priority'))->>'lastCheckedMessageId',(select id::text from read_state_messages where name='latest_low_priority'),'snapshot high-water mark advances inbox cursor');
select is(public.get_room_inbox_with_read_state((select room_a from read_state_ctx))->>'newCount','0','snapshot high-water mark checks all current NEW questions');
select is((select item->>'isNew' from jsonb_array_elements(public.get_room_inbox_with_read_state((select room_a from read_state_ctx))->'items') item where item->>'kind'='cluster'),'false','cluster loses NEW after all current questions are checked');
select is(public.mark_inbox_checked((select room_a from read_state_ctx),(select id::text from read_state_messages where name='latest_low_priority'))->>'lastCheckedMessageId',(select id::text from read_state_messages where name='latest_low_priority'),'same inbox cursor replay is idempotent');
select is(public.mark_inbox_checked((select room_a from read_state_ctx),(select id::text from read_state_messages where name='own_question'))->>'lastCheckedMessageId',(select id::text from read_state_messages where name='latest_low_priority'),'inbox cursor cannot regress');
select is(public.mark_inbox_checked((select room_a from read_state_ctx),null)->>'lastCheckedMessageId',(select id::text from read_state_messages where name='latest_low_priority'),'null replay preserves inbox cursor');
select set_config('request.jwt.claim.sub',(select owner_b::text from read_state_ctx),true);
select throws_ok($$select public.get_inbox_read_state((select room_a from read_state_ctx))$$,'P0001','NOT_FOUND','other owner cannot read inbox cursor');
select throws_ok($$select public.mark_inbox_checked((select room_a from read_state_ctx),null)$$,'P0001','NOT_FOUND','other owner cannot write inbox cursor');
select throws_ok($$select public.get_room_inbox_with_read_state((select room_a from read_state_ctx))$$,'P0001','NOT_FOUND','other owner cannot read inbox NEW');
select set_config('request.jwt.claim.sub',(select admin_id::text from read_state_ctx),true);
select throws_ok($$select public.get_inbox_read_state((select room_a from read_state_ctx))$$,'P0001','NOT_FOUND','admin role does not grant room owner cursor access');
select set_config('request.jwt.claim.sub',(select fan_a::text from read_state_ctx),true);
select throws_ok($$select public.get_room_inbox_with_read_state((select room_a from read_state_ctx))$$,'P0001','NOT_FOUND','fan cannot read owner inbox NEW');
reset role;

-- Leave, receive a linked answer while away, then rejoin with a new open period.
update private.room_member_periods set left_at=now()-interval '2 hours'
where room_id=(select room_a from read_state_ctx) and user_id=(select fan_a from read_state_ctx) and left_at is null;
update public.room_members set status='left',gauge=0,left_at=now()-interval '2 hours',left_month=date_trunc('month',now())::date
where room_id=(select room_a from read_state_ctx) and user_id=(select fan_a from read_state_ctx);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select fan_a::text from read_state_ctx),true);
select throws_ok($$select public.get_room_read_state((select room_a from read_state_ctx))$$,'P0001','ROOM_INACTIVE','departed fan cannot read room state');
select throws_ok($$select public.mark_room_read((select room_a from read_state_ctx),null)$$,'P0001','ROOM_INACTIVE','departed fan cannot mutate room cursor');
select is(jsonb_array_length(public.get_my_room_unread_counts()),0,'departed rooms disappear from unread count list');
select set_config('request.jwt.claim.sub',(select owner_a::text from read_state_ctx),true);
select is(public.mark_inbox_checked((select room_a from read_state_ctx),(select id::text from read_state_messages where name='latest_low_priority'))->>'lastCheckedMessageId',(select id::text from read_state_messages where name='latest_low_priority'),'owner replay remains valid after question sender leaves');
reset role;
do $$
declare c read_state_ctx%rowtype; v_question bigint;
begin
  select * into c from read_state_ctx;
  select id into v_question from read_state_messages where name='own_question';
  perform pg_temp.add_read_state_message('away_answer',c.owner_a,'influencer_answer',now()-interval '1 hour',p_reply=>v_question);
  insert into private.answer_question_links(room_id,answer_id,question_id)
  select c.room_a,id,v_question from read_state_messages where name='away_answer';
  perform pg_temp.add_read_state_message('away_broadcast',c.owner_a,'influencer_broadcast',now()-interval '1 hour');
  insert into private.room_member_periods(room_id,user_id,joined_at) values(c.room_a,c.fan_a,now());
  update public.room_members set status='active',gauge=100,joined_at=now(),left_at=null,left_month=null
  where room_id=c.room_a and user_id=c.fan_a;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select fan_a::text from read_state_ctx),true);
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'unreadCount','1','rejoining fan sees linked answer received while away but not away broadcast');
select is(public.get_room_read_state((select room_a from read_state_ctx))->>'firstUnreadMessageId',(select id::text from read_state_messages where name='away_answer'),'reentry divider targets own answer received while away');
select set_config('request.jwt.claim.sub',(select owner_a::text from read_state_ctx),true);
select is(public.get_room_inbox_with_read_state((select room_a from read_state_ctx))->>'newCount','0','reentry does not relabel old questions NEW');
reset role;

set local role anon;
select throws_ok($$select public.get_room_read_state((select room_a from read_state_ctx))$$,'42501',null,'anon role cannot execute room read-state RPC');
select throws_ok($$select public.mark_inbox_checked((select room_a from read_state_ctx),null)$$,'42501',null,'anon role cannot execute inbox mutation RPC');
reset role;

select * from finish();
rollback;
