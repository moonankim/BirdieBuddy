create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('user', 'influencer', 'admin');
create type public.influencer_type as enum ('youtuber', 'media_pro', 'tour');
create type public.card_style as enum ('illust', 'retro', 'holo');
create type public.card_grade as enum ('common', 'rare', 'epic', 'special');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '버디' check (char_length(nickname) between 1 and 30),
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  type public.influencer_type not null,
  verified_at timestamptz,
  profile_image_path text,
  created_at timestamptz not null default now()
);

create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete restrict,
  style public.card_style not null,
  image_path text not null,
  unique (influencer_id, style),
  unique (influencer_id, id),
  check (image_path = influencer_id::text || '/' || style::text || '.webp')
);

create table public.user_cards (
  user_id uuid not null references public.profiles (id) on delete restrict,
  template_id uuid not null references public.card_templates (id) on delete restrict,
  grade public.card_grade not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, template_id, grade)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  played_at timestamptz not null default clock_timestamp(),
  period_month date not null check (extract(day from period_month) = 1),
  clock_kind text not null check (clock_kind in ('real', 'demo')),
  unique (user_id, id)
);

create table public.draws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  round_id uuid not null unique,
  template_id uuid not null references public.card_templates (id) on delete restrict,
  grade public.card_grade not null,
  is_new boolean not null,
  forced boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (user_id, round_id) references public.rounds (user_id, id) on delete restrict
);

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null unique references public.influencers (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (influencer_id, id)
);

create table public.room_members (
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  gauge numeric(5,1) not null check (gauge between 0 and 100),
  status text not null check (status in ('active', 'left')),
  joined_at timestamptz not null,
  joined_month date not null check (extract(day from joined_month) = 1),
  left_at timestamptz,
  left_month date check (left_month is null or extract(day from left_month) = 1),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  check (
    (status = 'active' and gauge > 0 and left_at is null and left_month is null)
    or (status = 'left' and gauge = 0 and left_at is not null and left_month is not null)
  ),
  unique (room_id, user_id, status)
);

create table public.message_clusters (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  representative text not null check (char_length(representative) between 1 and 200),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, id)
);

create table public.messages (
  id bigint generated always as identity primary key,
  id_text text not null unique,
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  sender_type text not null check (sender_type in ('user', 'influencer')),
  message_kind text not null check (message_kind in ('user_question', 'influencer_answer', 'influencer_broadcast', 'greeting')),
  recipient_user_id uuid references public.profiles (id) on delete restrict,
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  reply_to bigint,
  reply_to_text text,
  reply_context text,
  body text,
  deleted_at timestamptz,
  passes_all_filters boolean,
  support_badge text check (support_badge is null or support_badge in ('none', 'buddy', 'eagle', 'albatross')),
  own_score numeric(5,2) check (own_score is null or own_score between 0 and 100),
  quality_score numeric(5,2) check (quality_score is null or quality_score between 0 and 100),
  priority numeric(5,2) check (priority is null or priority between 0 and 100),
  cluster_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, id),
  foreign key (room_id, reply_to) references public.messages (room_id, id) on delete restrict,
  foreign key (room_id, cluster_id) references public.message_clusters (room_id, id) on delete restrict,
  check ((reply_to is null) = (reply_to_text is null)),
  check (reply_to_text is null or reply_to_text = reply_to::text),
  check (id_text = id::text),
  check ((body is null and deleted_at is not null and message_kind in ('influencer_answer', 'influencer_broadcast'))
      or (body is not null and deleted_at is null and char_length(body) between 1 and 2000)),
  check (
    (message_kind = 'user_question' and sender_type = 'user' and recipient_user_id is null
      and reply_to is null and reply_context is null and passes_all_filters is not null
      and support_badge is not null and own_score is not null and quality_score is not null and priority is not null)
    or (message_kind = 'influencer_answer' and sender_type = 'influencer' and recipient_user_id is null
      and reply_to is not null and passes_all_filters is null and support_badge is null
      and own_score is null and quality_score is null and priority is null)
    or (message_kind = 'influencer_broadcast' and sender_type = 'influencer' and recipient_user_id is null
      and reply_to is null and reply_context is null and cluster_id is null and passes_all_filters is null
      and support_badge is null and own_score is null and quality_score is null and priority is null)
    or (message_kind = 'greeting' and sender_type = 'influencer' and recipient_user_id is not null
      and reply_to is null and reply_context is null and cluster_id is null and passes_all_filters is null
      and support_badge is null and own_score is null and quality_score is null and priority is null)
  )
);

create unique index messages_greeting_once_idx
  on public.messages (room_id, recipient_user_id)
  where message_kind = 'greeting';
create unique index messages_active_reply_idx
  on public.messages (room_id, reply_to)
  where message_kind = 'influencer_answer' and deleted_at is null and cluster_id is null;
create unique index messages_active_cluster_reply_idx
  on public.messages (room_id, cluster_id)
  where message_kind = 'influencer_answer' and deleted_at is null and cluster_id is not null;

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete restrict,
  type public.influencer_type not null,
  evidence_url text not null check (char_length(evidence_url) between 1 and 2048),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) between 1 and 500),
  reviewed_by uuid references public.profiles (id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)
  )
);
create unique index verifications_one_pending_idx
  on public.verifications (influencer_id) where status = 'pending';

create table public.game_config (
  key text primary key check (char_length(key) between 1 and 80),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version >= 1)
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create table private.influencer_accounts (
  influencer_id uuid primary key references public.influencers (id) on delete restrict,
  user_id uuid not null unique references public.profiles (id) on delete restrict
);

create table private.demo_accounts (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  can_force_grade boolean not null default false,
  can_advance_month boolean not null default false
);

create table private.demo_clock (
  id text primary key check (id = 'hackathon'),
  current_month date not null check (extract(day from current_month) = 1),
  version integer not null default 1 check (version >= 1)
);

create table private.demo_month_runs (
  closed_month date primary key check (extract(day from closed_month) = 1),
  target_month date not null unique check (extract(day from target_month) = 1),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (actor_id, request_id)
);

create table private.room_settings (
  room_id uuid primary key references public.chat_rooms (id) on delete restrict,
  disabled_filters text[] not null default '{}',
  greeting_text text,
  version integer not null default 1 check (version >= 1),
  last_write_at timestamptz not null default '-infinity'
);

create table private.room_member_periods (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  joined_at timestamptz not null,
  left_at timestamptz,
  check (left_at is null or left_at > joined_at),
  unique (room_id, user_id, id)
);
create unique index room_member_periods_one_open_idx
  on private.room_member_periods (room_id, user_id) where left_at is null;

create table private.moderation_suggestions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  request_id uuid not null,
  token_hash text not null unique,
  body_hash text not null,
  rewrite_quality numeric(5,2) not null check (rewrite_quality between 0 and 100),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (actor_id, room_id, request_id)
);

create table private.operations (
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  request_id uuid not null,
  payload_hash text not null,
  state text not null check (state in ('processing', 'succeeded', 'failed')),
  result jsonb,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (actor_id, operation, request_id),
  check ((lease_token is null) = (lease_until is null)),
  check (state = 'processing' or (lease_token is null and lease_until is null))
);

create table private.moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  request_id uuid not null,
  verdict text not null check (verdict in ('pass', 'suggest', 'block')),
  category text,
  created_at timestamptz not null default now(),
  unique (actor_id, request_id)
);

create table private.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null unique references public.verifications (id) on delete restrict,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  reviewed_at timestamptz not null default now()
);

create table private.answer_question_links (
  answer_id bigint not null references public.messages (id) on delete restrict,
  question_id bigint not null references public.messages (id) on delete restrict,
  room_id uuid not null references public.chat_rooms (id) on delete restrict,
  primary key (answer_id, question_id)
);

create table private.rate_windows (
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  scope_id uuid not null,
  window_start timestamptz not null,
  count integer not null check (count >= 0),
  blocked_until timestamptz,
  primary key (actor_id, operation, scope_id, window_start)
);

create table private.demo_fixture_runs (
  fixture_version text primary key,
  completed_at timestamptz not null default now()
);

create table private.runtime_flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index rounds_user_kind_month_idx on public.rounds (user_id, clock_kind, period_month);
create index user_cards_user_template_idx on public.user_cards (user_id, template_id, grade);
create index draws_user_template_idx on public.draws (user_id, template_id);
create index room_members_room_status_idx on public.room_members (room_id, status);
create index messages_room_id_idx on public.messages (room_id, id);
create index messages_room_updated_id_idx on public.messages (room_id, updated_at, id);
create index messages_inbox_priority_idx on public.messages (room_id, priority desc, id desc)
  where sender_type = 'user' and message_kind = 'user_question';
create index room_member_periods_room_user_idx
  on private.room_member_periods (room_id, user_id, joined_at, left_at);
create index verifications_pending_page_idx on public.verifications (status, created_at, id);
create index moderation_events_room_day_idx on private.moderation_events (room_id, created_at, actor_id, request_id);
