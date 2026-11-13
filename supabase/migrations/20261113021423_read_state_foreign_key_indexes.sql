create index if not exists room_read_states_user_id_idx
  on private.room_read_states (user_id);

create index if not exists room_read_states_room_last_read_message_idx
  on private.room_read_states (room_id, last_read_message_id);

create index if not exists inbox_read_states_user_id_idx
  on private.inbox_read_states (user_id);

create index if not exists inbox_read_states_room_last_checked_message_idx
  on private.inbox_read_states (room_id, last_checked_message_id);
