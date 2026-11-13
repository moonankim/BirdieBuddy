begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table history_ctx (fan_id uuid, owner_id uuid, room_id uuid);
insert into history_ctx values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
create temporary table history_ids (position integer primary key, id text);
create temporary table history_pages (direction text, page integer, result jsonb);
grant select on history_ctx, history_ids to authenticated;
grant all on history_pages to authenticated;

do $$
declare
  v_ctx record;
  v_influencer uuid := gen_random_uuid();
  v_id text;
begin
  select * into v_ctx from history_ctx;
  insert into auth.users(id, email) values
    (v_ctx.fan_id, v_ctx.fan_id || '@history-cursor.test'),
    (v_ctx.owner_id, v_ctx.owner_id || '@history-cursor.test');
  update public.profiles set role = 'influencer' where id = v_ctx.owner_id;
  insert into public.influencers(id, name, type, verified_at)
    values (v_influencer, 'History cursor test', 'tour', now());
  insert into private.influencer_accounts(user_id, influencer_id) values (v_ctx.owner_id, v_influencer);
  insert into public.chat_rooms(id, influencer_id) values (v_ctx.room_id, v_influencer);
  insert into public.room_members(room_id, user_id, gauge, status, joined_at, joined_month)
    values (v_ctx.room_id, v_ctx.fan_id, 100, 'active', now() - interval '1 day', date_trunc('month', now())::date);
  insert into private.room_member_periods(room_id, user_id, joined_at)
    values (v_ctx.room_id, v_ctx.fan_id, now() - interval '1 day');
  -- Remove only this transaction's automatic greeting before the seven-message fixture.
  delete from public.messages where room_id = v_ctx.room_id and message_kind = 'greeting';
  for i in 1..7 loop
    insert into public.messages(room_id, sender_id, sender_type, message_kind, sender_name, body)
      values (v_ctx.room_id, v_ctx.owner_id, 'influencer', 'influencer_broadcast', 'History owner', 'Message ' || i)
      returning id_text into v_id;
    insert into history_ids values (i, v_id);
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub', (select fan_id::text from history_ctx), true);
set local role authenticated;
insert into history_pages values ('older', 1, public.get_messages((select room_id from history_ctx), p_limit => 3));
insert into history_pages values ('older', 2, public.get_messages((select room_id from history_ctx),
  p_before_id => (select result->>'nextCursor' from history_pages where direction = 'older' and page = 1), p_limit => 3));
insert into history_pages values ('older', 3, public.get_messages((select room_id from history_ctx),
  p_before_id => (select result->>'nextCursor' from history_pages where direction = 'older' and page = 2), p_limit => 3));

select is((select result->>'nextCursor' from history_pages where direction = 'older' and page = 1),
  (select id from history_ids where position = 5), 'older-page cursor is the smallest returned id');
select is((select array_agg(e.value->>'body' order by e.ordinality) from history_pages p,
  jsonb_array_elements(p.result->'items') with ordinality e(value, ordinality) where p.direction = 'older' and p.page = 1),
  array['Message 5', 'Message 6', 'Message 7'], 'latest page is presented oldest-first');
select is((select array_agg(e.value->>'body' order by e.ordinality) from history_pages p,
  jsonb_array_elements(p.result->'items') with ordinality e(value, ordinality) where p.direction = 'older' and p.page = 2),
  array['Message 2', 'Message 3', 'Message 4'], 'next older page contains the preceding messages');
select is((select result->>'nextCursor' from history_pages where direction = 'older' and page = 3),
  null::text, 'final partial older page has no next cursor');
select is((select count(*)::integer from history_pages p, jsonb_array_elements(p.result->'items') e where p.direction = 'older'),
  7, 'older pagination returns every message exactly once');
select is((select count(distinct e.value->>'id')::integer from history_pages p,
  jsonb_array_elements(p.result->'items') e where p.direction = 'older'), 7, 'older pagination does not repeat message ids');

insert into history_pages values ('newer', 1, public.get_messages((select room_id from history_ctx),
  p_after_id => (select id from history_ids where position = 1), p_limit => 3));
insert into history_pages values ('newer', 2, public.get_messages((select room_id from history_ctx),
  p_after_id => (select result->>'nextCursor' from history_pages where direction = 'newer' and page = 1), p_limit => 3));
select is((select result->>'nextCursor' from history_pages where direction = 'newer' and page = 1),
  (select id from history_ids where position = 4), 'newer-page cursor remains the largest returned id');
select is((select result->>'nextCursor' from history_pages where direction = 'newer' and page = 2),
  null::text, 'exact-size final newer page has no next cursor');
select is((select count(distinct e.value->>'id')::integer from history_pages p,
  jsonb_array_elements(p.result->'items') e where p.direction = 'newer'), 6, 'newer pagination also advances without duplicates');
select throws_ok($$select public.get_messages((select room_id from history_ctx), '1', '2', 3)$$,
  'P0001', 'VALIDATION_ERROR', 'mutually exclusive cursors remain rejected');
select ok(not has_function_privilege('anon', 'public.get_messages(uuid,text,text,integer)', 'EXECUTE'),
  'replacement function preserves anonymous denial');
reset role;
select * from finish();
rollback;
