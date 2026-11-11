-- Cover foreign keys not served by an existing leading-column index.
create index if not exists answer_question_links_question_idx on private.answer_question_links(question_id);
create index if not exists answer_question_links_room_idx on private.answer_question_links(room_id);
create index if not exists moderation_suggestions_room_idx on private.moderation_suggestions(room_id);
create index if not exists room_member_periods_user_idx on private.room_member_periods(user_id);
create index if not exists verification_reviews_reviewer_idx on private.verification_reviews(reviewer_id);
create index if not exists draws_template_idx on public.draws(template_id);
create index if not exists draws_user_round_idx on public.draws(user_id,round_id);
create index if not exists messages_recipient_idx on public.messages(recipient_user_id);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists room_members_user_idx on public.room_members(user_id);
create index if not exists user_cards_template_idx on public.user_cards(template_id);
create index if not exists verifications_reviewed_by_idx on public.verifications(reviewed_by);
