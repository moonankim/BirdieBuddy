import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBackendApi } from '../../lib/api/index.js';

const networkFailure = {
  ok: false,
  error: { code: 'NETWORK_ERROR', message: '네트워크 요청에 실패했습니다.', retryable: true },
};

function clientWithFetch(fetch: typeof globalThis.fetch) {
  return createClient('https://transport-test.supabase.co', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { retry: false },
    global: { fetch },
  });
}

const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('a lost complete_round response stays retryable and the same request ID recovers its award', async () => {
  const requestId = '10000000-0000-4000-8000-000000000001';
  const requests: string[] = [];
  const awards = new Map<string, unknown>();
  const award = {
    roundId: '20000000-0000-4000-8000-000000000001',
    drawId: '30000000-0000-4000-8000-000000000001',
    grade: 'rare', isNew: true, ownedCount: 1, entryUnlocked: false,
    template: {
      id: '40000000-0000-4000-8000-000000000001',
      influencerId: '50000000-0000-4000-8000-000000000001',
      influencerName: '테스트 선수', influencerType: 'tour', verifiedAt: null,
      style: 'illust', imagePath: null,
    },
  };
  const client = clientWithFetch(async (url, options) => {
    assert.equal(String(url), 'https://transport-test.supabase.co/rest/v1/rpc/complete_round');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.p_force_grade, null);
    requests.push(body.p_request_id);
    if (!awards.has(body.p_request_id)) {
      awards.set(body.p_request_id, award); // The transaction commits before its response is lost.
      throw new TypeError('Failed to fetch: private transport details');
    }
    return jsonResponse(awards.get(body.p_request_id));
  });
  const api = createBackendApi(client);

  assert.deepEqual(await api.completeRound({ requestId }), networkFailure);
  const retry = await api.completeRound({ requestId });

  assert.equal(retry.ok, true);
  assert.equal(retry.data.drawId, award.drawId);
  assert.equal(retry.data.roundId, award.roundId);
  assert.deepEqual(requests, [requestId, requestId]);
  assert.equal(awards.size, 1);
});

test('RPC aborts use the safe retryable network error instead of the raw abort stack', async () => {
  const api = createBackendApi(clientWithFetch(async () => {
    throw new DOMException('private abort context', 'AbortError');
  }));

  assert.deepEqual(await api.getAdminDemoMonth(), networkFailure);
});

test('direct Data API reads normalize fetch failures as well as RPC calls', async () => {
  const api = createBackendApi(clientWithFetch(async () => {
    throw new TypeError('Failed to fetch: private transport details');
  }));

  assert.deepEqual(await api.getOwnedCards(), networkFailure);
});

test('Edge FunctionsFetchError is identified by its class and hides the underlying context', async () => {
  const api = createBackendApi(clientWithFetch(async () => {
    throw new TypeError('Failed to fetch: private Edge transport details');
  }));

  assert.deepEqual(await api.submitMessage({
    requestId: '10000000-0000-4000-8000-000000000001',
    roomId: '60000000-0000-4000-8000-000000000001', body: '테스트 질문',
  }), networkFailure);
});

test('a PostgREST status-zero error result is retryable without exposing its details', async () => {
  const client = {
    rpc: async () => ({
      data: null, status: 0,
      error: { code: '', message: 'FetchError: connection lost', details: 'private stack' },
    }),
  } as unknown as SupabaseClient<any>;

  assert.deepEqual(await createBackendApi(client).markRoomRead({
    roomId: '60000000-0000-4000-8000-000000000001', lastReadMessageId: '42',
  }), networkFailure);
});

test('database business errors keep their code, localized message and retry policy', async () => {
  const api = createBackendApi(clientWithFetch(async () => jsonResponse({
    code: 'P0001', message: 'FORBIDDEN', details: null, hint: null,
  }, 403)));

  assert.deepEqual(await api.getAdminDemoMonth(), {
    ok: false,
    error: { code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다.', retryable: false },
  });
});

test('an upstream HTTP error with an empty code is not mislabeled as a transport failure', async () => {
  const api = createBackendApi(clientWithFetch(async () => jsonResponse({
    code: '', message: 'Bad request', details: null, hint: null,
  }, 400)));
  const result = await api.getAdminDemoMonth();

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Expected an error');
  assert.notEqual(result.error.code, 'NETWORK_ERROR');
  assert.equal(result.error.retryable, false);
});
