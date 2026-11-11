-- LOCAL MOCK FIXTURE: local-only sample issuance; never a migration or production algorithm.
create or replace function private.issue_card(
  p_user_id uuid,
  p_round_id uuid,
  p_force_grade public.card_grade
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_template public.card_templates%rowtype;
  v_influencer public.influencers%rowtype;
  v_grade public.card_grade := coalesce(p_force_grade,'common'::public.card_grade);
  v_draw_id uuid;
  v_is_new boolean;
  v_owned_count integer;
  v_earned_before integer;
begin
  if not exists (
    select 1 from public.rounds r where r.id=p_round_id and r.user_id=p_user_id
  ) then
    raise exception 'LOCAL_ISSUE_CARD_FIXTURE_INVALID_ROUND' using errcode='22023';
  end if;

  select t.* into v_template
  from public.card_templates t
  join public.influencers i on i.id=t.influencer_id
  where i.verified_at is not null
  order by t.influencer_id,t.style
  limit 1;
  if not found then
    raise exception 'LOCAL_ISSUE_CARD_FIXTURE_NO_TEMPLATE' using errcode='55000';
  end if;
  select i.* into v_influencer from public.influencers i where i.id=v_template.influencer_id;

  select count(*)::integer into v_earned_before
  from public.draws d
  join public.card_templates t on t.id=d.template_id
  where d.user_id=p_user_id and t.influencer_id=v_template.influencer_id;

  select not exists (
    select 1 from public.user_cards c
    where c.user_id=p_user_id and c.template_id=v_template.id and c.count>0
  ) into v_is_new;

  insert into public.draws(user_id,round_id,template_id,grade,is_new,forced)
  values(p_user_id,p_round_id,v_template.id,v_grade,v_is_new,p_force_grade is not null)
  returning id into v_draw_id;

  insert into public.user_cards as owned_card(user_id,template_id,grade,count)
  values(p_user_id,v_template.id,v_grade,1)
  on conflict(user_id,template_id,grade)
  do update set count=owned_card.count+1,updated_at=clock_timestamp()
  returning count into v_owned_count;

  return jsonb_build_object(
    'drawId',v_draw_id,
    'grade',v_grade,
    'template',jsonb_build_object(
      'id',v_template.id,
      'influencerId',v_influencer.id,
      'influencerName',v_influencer.name,
      'influencerType',v_influencer.type,
      'verifiedAt',v_influencer.verified_at,
      'style',v_template.style,
      'imagePath',v_template.image_path
    ),
    'isNew',v_is_new,
    'ownedCount',v_owned_count,
    'entryUnlocked',v_earned_before<5 and v_earned_before+1>=5
  );
end;
$function$;

revoke all on function private.issue_card(uuid,uuid,public.card_grade) from public,anon,authenticated,service_role;
grant execute on function private.issue_card(uuid,uuid,public.card_grade) to postgres;
comment on function private.issue_card(uuid,uuid,public.card_grade)
is 'LOCAL MOCK FIXTURE: deterministic sample award for isolated local development only. Replace with MoonhwanP A-09.';
