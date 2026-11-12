begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table admin_demo_month_ctx (
  admin_id uuid,
  admin_without_capability_id uuid,
  user_with_capability_id uuid,
  no_name_id uuid,
  blank_name_id uuid
);
insert into admin_demo_month_ctx values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

do $$
declare
  v_admin uuid;
  v_admin_without_capability uuid;
  v_user_with_capability uuid;
  v_no_name uuid;
  v_blank_name uuid;
begin
  select admin_id, admin_without_capability_id, user_with_capability_id, no_name_id, blank_name_id
    into v_admin, v_admin_without_capability, v_user_with_capability, v_no_name, v_blank_name
  from admin_demo_month_ctx;

  insert into auth.users (id, email) values
    (v_admin, v_admin || '@admin-demo-month.test'),
    (v_admin_without_capability, v_admin_without_capability || '@admin-demo-month.test'),
    (v_user_with_capability, v_user_with_capability || '@admin-demo-month.test');
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_no_name, v_no_name || '@admin-demo-month.test', '{}'::jsonb),
    (v_blank_name, v_blank_name || '@admin-demo-month.test', jsonb_build_object('nickname', '   '));

  update public.profiles set role = 'admin'::public.user_role where id in (v_admin, v_admin_without_capability);
  update public.profiles set role = 'user'::public.user_role where id = v_user_with_capability;
  insert into private.demo_accounts (user_id, can_advance_month) values
    (v_admin, true), (v_admin_without_capability, false), (v_user_with_capability, true);
  insert into private.demo_clock (id, current_month)
  values ('hackathon', date_trunc('month', clock_timestamp() at time zone 'Asia/Seoul')::date)
  on conflict (id) do nothing;
end;
$$;

select is(
  (select nickname from public.profiles where id = (select no_name_id from admin_demo_month_ctx)),
  '버디',
  'auth user without a nickname receives a visible default profile name'
);
select is(
  (select nickname from public.profiles where id = (select blank_name_id from admin_demo_month_ctx)),
  '버디',
  'blank auth nickname receives the same visible default profile name'
);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.get_admin_demo_month()$$,
  'P0001', 'UNAUTHENTICATED', 'anonymous identity is rejected'
);

select set_config('request.jwt.claim.sub', (select admin_without_capability_id::text from admin_demo_month_ctx), true);
select throws_ok(
  $$select public.get_admin_demo_month()$$,
  'P0001', 'FORBIDDEN', 'admin without month capability is rejected'
);

select set_config('request.jwt.claim.sub', (select user_with_capability_id::text from admin_demo_month_ctx), true);
select throws_ok(
  $$select public.get_admin_demo_month()$$,
  'P0001', 'FORBIDDEN', 'month capability does not grant a non-admin access'
);

select set_config('request.jwt.claim.sub', (select admin_id::text from admin_demo_month_ctx), true);
select is(
  public.get_admin_demo_month(),
  (select current_month from private.demo_clock where id = 'hackathon'),
  'authorized admin reads the authoritative demo clock month'
);

select * from finish();
rollback;
