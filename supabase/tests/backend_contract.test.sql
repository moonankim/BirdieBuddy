begin;
select plan(19);

select has_table('public','profiles','profiles is present');
select has_table('public','messages','messages is present');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),12,'twelve public domain tables are present');
select is((select count(*)::integer from public.influencers),11,'seed includes ten verified influencers and one pending influencer');
select is((select count(*)::integer from public.card_templates),30,'seed includes thirty card templates');
select is((select count(*)::integer from public.chat_rooms),10,'pending influencer has no room before approval');
select is((select count(*)::integer from public.verifications where status='pending'),1,'seed includes one pending verification');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),'RLS is enabled on every public domain table');
select has_column('public','messages','id_text','string message id is available');
select has_column('public','messages','reply_to_text','string reply id is available');
select ok(has_column_privilege('authenticated','public.messages','id_text','SELECT'),'authenticated can read text message IDs');
select ok(not has_column_privilege('authenticated','public.messages','id','SELECT'),'authenticated cannot read bigint message IDs');
select ok(not has_table_privilege('authenticated','public.messages','INSERT'),'authenticated cannot insert messages directly');
select ok(not has_table_privilege('anon','public.messages','SELECT'),'anonymous users cannot read messages');
select ok(not has_table_privilege('authenticated','private.demo_accounts','SELECT'),'authenticated cannot read private capabilities');
select ok(not has_function_privilege('authenticated','public.begin_message_submission(uuid,uuid,uuid,text)','EXECUTE'),'message reservation is service-role only');
select ok(has_function_privilege('service_role','public.begin_message_submission(uuid,uuid,uuid,text)','EXECUTE'),'Edge service role can reserve message work');
select ok((select public from storage.buckets where id='card-assets'),'card assets are publicly readable');
select ok((select allowed_mime_types @> array['image/webp'] from storage.buckets where id='influencer-profiles'),'profile bucket accepts WebP images');

select * from finish();
rollback;
