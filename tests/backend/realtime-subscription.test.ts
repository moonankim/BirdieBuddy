import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBackendApi } from '../../lib/api/index.js';

class FakeChannel {
  private onChange?: (payload: unknown) => void;

  on(_type: string, _filter: unknown, callback: (payload: unknown) => void) {
    this.onChange = callback;
    return this;
  }

  subscribe(callback: (status: string, error?: Error) => void) {
    callback('SUBSCRIBED');
    return this;
  }

  emit(payload: unknown) {
    this.onChange?.(payload);
  }
}

const answerRow = {
  id_text: '42', room_id: 'room-1', sender_id: 'influencer-1', sender_type: 'influencer',
  message_kind: 'influencer_answer', recipient_user_id: null, sender_name: '프로', body: '답변',
  reply_to_text: '7', reply_context: '질문', deleted_at: null, passes_all_filters: null,
  created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T00:00:00Z', cluster_id: null,
  support_badge: null, own_score: null, quality_score: null, priority: null,
};

async function flushMicrotasks() {
  for (let count = 0; count < 8; count += 1) await Promise.resolve();
}

test('buffers answer events and retries enrichment without reporting a channel failure', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const channel = new FakeChannel();
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const responses = [
    { data: null, error: new Error('temporary lookup failure') },
    { data: { items: [{ answerId: '42', isReplyToMe: true }] }, error: null },
  ];
  const client = {
    channel: () => channel,
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return responses.shift();
    },
    removeChannel: async () => 'ok',
  } as unknown as SupabaseClient<any>;
  const api = createBackendApi(client);
  const messages: unknown[] = [];
  const statuses: string[] = [];
  const enrichmentFailures: string[][] = [];
  const unsubscribe = api.subscribeRoomMessages({
    roomId: 'room-1',
    onMessage: (message) => messages.push(message),
    onStatus: (status) => statuses.push(status),
    onMessageEnrichmentError: (ids) => enrichmentFailures.push([...ids]),
  });
  t.after(() => { unsubscribe(); mock.timers.reset(); });

  channel.emit({ new: answerRow });
  await flushMicrotasks();

  assert.deepEqual(statuses, ['SUBSCRIBED']);
  assert.deepEqual(messages, []);
  assert.deepEqual(enrichmentFailures, [['42']]);
  assert.equal(calls.length, 1);

  mock.timers.tick(3000);
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.name, 'get_my_answer_links');
  assert.deepEqual(calls[1]?.args.p_answer_ids, ['42']);
  assert.equal(messages.length, 1);
  assert.deepEqual(messages.map((message) => (message as { isReplyToMe: boolean }).isReplyToMe), [true]);
  assert.deepEqual(statuses, ['SUBSCRIBED']);

});
