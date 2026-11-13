import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBackendApi } from '../../lib/api/index.js';
import { decodeCursor } from '../../lib/api/cursor.js';

const roomId = '11111111-1111-4111-8111-111111111111';
const largeId = '90071992547409931';

test('read-state RPCs preserve bigint message IDs and null initialization cursors', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const replies = [
    { roomId, lastReadMessageId: largeId, firstUnreadMessageId: '90071992547409932', unreadCount: 2 },
    { lastReadMessageId: largeId },
    { lastReadMessageId: null },
    { roomId, lastCheckedMessageId: largeId },
    { lastCheckedMessageId: largeId },
    { lastCheckedMessageId: null },
  ];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: replies.shift(), error: null };
    },
  } as unknown as SupabaseClient<any>;
  const api = createBackendApi(client);

  assert.deepEqual(await api.getRoomReadState({ roomId }), {
    ok: true,
    data: { roomId, lastReadMessageId: largeId, firstUnreadMessageId: '90071992547409932', unreadCount: 2 },
  });
  assert.deepEqual(await api.markRoomRead({ roomId, lastReadMessageId: largeId }), { ok: true, data: { lastReadMessageId: largeId } });
  assert.deepEqual(await api.markRoomRead({ roomId, lastReadMessageId: null }), { ok: true, data: { lastReadMessageId: null } });
  assert.deepEqual(await api.getInboxReadState({ roomId }), { ok: true, data: { roomId, lastCheckedMessageId: largeId } });
  assert.deepEqual(await api.markInboxChecked({ roomId, lastCheckedMessageId: largeId }), { ok: true, data: { lastCheckedMessageId: largeId } });
  assert.deepEqual(await api.markInboxChecked({ roomId, lastCheckedMessageId: null }), { ok: true, data: { lastCheckedMessageId: null } });
  assert.deepEqual(calls, [
    { name: 'get_room_read_state', args: { p_room_id: roomId } },
    { name: 'mark_room_read', args: { p_room_id: roomId, p_last_read_message_id: largeId } },
    { name: 'mark_room_read', args: { p_room_id: roomId, p_last_read_message_id: null } },
    { name: 'get_inbox_read_state', args: { p_room_id: roomId } },
    { name: 'mark_inbox_checked', args: { p_room_id: roomId, p_last_checked_message_id: largeId } },
    { name: 'mark_inbox_checked', args: { p_room_id: roomId, p_last_checked_message_id: null } },
  ]);
});

test('read-state authorization failures keep the standard Result contract', async () => {
  const client = {
    rpc: async () => ({ data: null, error: { code: 'P0001', message: 'ROOM_INACTIVE' } }),
  } as unknown as SupabaseClient<any>;

  assert.deepEqual(await createBackendApi(client).getRoomReadState({ roomId }), {
    ok: false,
    error: { code: 'ROOM_INACTIVE', message: '현재 이 채팅방을 이용할 수 없습니다.', retryable: false },
  });
});

test('inbox NEW metadata and bigint pagination cursors round-trip through the SDK', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const cursor = { revision: 'revision-1', priority: 123.5, tieMessageId: largeId, inboxKey: `question:${largeId}` };
  const items = [
    { kind: 'question', inboxKey: `question:${largeId}`, isNew: true, answered: false, question: { id: largeId } },
    { kind: 'cluster', inboxKey: 'cluster:cluster-1', isNew: true, answered: false, activeMessageIds: [largeId, '90071992547409932'] },
  ];
  const replies = [
    { items, revision: 'revision-1', newCount: '3', checkedThroughMessageId: '90071992547409932', nextCursor: cursor },
    { revision: 'revision-1', nextCursor: null },
  ];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: replies.shift(), error: null };
    },
  } as unknown as SupabaseClient<any>;
  const api = createBackendApi(client);
  const first = await api.getRoomInbox({ roomId, limit: 2 });
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error('inbox request failed');
  assert.deepEqual(first.data.items, items);
  assert.equal(first.data.newCount, 3);
  assert.equal(first.data.checkedThroughMessageId, '90071992547409932');
  assert.deepEqual(decodeCursor(first.data.nextCursor), cursor);

  assert.deepEqual(await api.getRoomInbox({ roomId, includeAnswered: true, cursor: first.data.nextCursor }), {
    ok: true,
    data: { items: [], revision: 'revision-1', newCount: 0, checkedThroughMessageId: null, nextCursor: null },
  });
  assert.deepEqual(calls, [
    { name: 'get_room_inbox_with_read_state', args: { p_room_id: roomId, p_include_answered: false, p_cursor: null, p_limit: 2 } },
    { name: 'get_room_inbox_with_read_state', args: { p_room_id: roomId, p_include_answered: true, p_cursor: cursor, p_limit: 50 } },
  ]);
});

function roomClient(counts: () => Promise<{ data: unknown; error: unknown }>, catalogError: unknown = null) {
  const rows = ['room-1', 'room-2', 'room-3'].map((id) => ({
    room_id: id, influencer_id: `influencer-${id}`, influencer_name: id, influencer_type: 'pro',
    verified_at: '2026-11-13T00:00:00Z', profile_image_path: null, fallback_image_path: null,
    required_cards: 3, earned_cards: 3, missing_cards: 0, support_badge: 'none', card_status: 'ready',
    can_join: true, join_reason: 'eligible', current_month_round_count: 0, required_rounds_to_rejoin: 0,
    membership: null,
  }));
  const client = {
    from: (table: string) => {
      assert.equal(table, 'room_catalog');
      return {
        select: (columns: string) => {
          assert.equal(columns, '*');
          return { order: async () => ({ data: rows, error: catalogError }) };
        },
      };
    },
    rpc: (name: string) => {
      assert.equal(name, 'get_my_room_unread_counts');
      return counts();
    },
  } as unknown as SupabaseClient<any>;
  return createBackendApi(client);
}

test('room catalog combines counts by room ID and preserves known zero counts', async () => {
  const api = roomClient(async () => ({ data: [{ roomId: 'room-2', unreadCount: 0 }, { roomId: 'room-1', unreadCount: 7 }], error: null }));
  const result = await api.getRooms();
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('room catalog request failed');
  assert.deepEqual(result.data.items.map((room) => [room.roomId, room.unreadCount]), [['room-1', 7], ['room-2', 0], ['room-3', null]]);
});

for (const transport of ['returned error', 'rejected request'] as const) {
  test(`room catalog survives an optional unread-count ${transport}`, async () => {
    const api = roomClient(async () => {
      const error = { code: 'NETWORK_ERROR', message: 'temporary counts failure' };
      if (transport === 'rejected request') throw error;
      return { data: null, error };
    });
    const result = await api.getRooms();
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('optional count lookup discarded the room catalog');
    assert.deepEqual(result.data.items.map((room) => [room.roomId, room.unreadCount]), [['room-1', null], ['room-2', null], ['room-3', null]]);
  });
}

test('room catalog still reports its own query failure', async () => {
  const api = roomClient(async () => ({ data: [], error: null }), { code: 'P0001', message: 'FORBIDDEN' });
  assert.deepEqual(await api.getRooms(), {
    ok: false,
    error: { code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다.', retryable: false },
  });
});
