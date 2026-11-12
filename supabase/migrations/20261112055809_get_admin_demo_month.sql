create or replace function public.get_admin_demo_month()
returns date
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_month date;
begin
  if v_actor is null then
    perform private.raise_api_error('UNAUTHENTICATED');
  end if;
  if private.current_role() is distinct from 'admin'::public.user_role or not exists (
    select 1 from private.demo_accounts d
    where d.user_id = v_actor and d.can_advance_month
  ) then
    perform private.raise_api_error('FORBIDDEN');
  end if;

  select c.current_month into v_month
  from private.demo_clock c
  where c.id = 'hackathon';
  if v_month is null then
    perform private.raise_api_error('CONFIG_INVALID');
  end if;
  return v_month;
end;
$function$;

revoke all on function public.get_admin_demo_month() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_demo_month() to authenticated;
