import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBackendApi } from '../../lib/api/index.js';

test('reads the authoritative demo month through the admin RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: '2026-11-01', error: null };
    },
  } as unknown as SupabaseClient<any>;

  const result = await createBackendApi(client).getAdminDemoMonth();

  assert.deepEqual(result, { ok: true, data: '2026-11-01' });
  assert.deepEqual(calls, [{ name: 'get_admin_demo_month', args: {} }]);
});

test('keeps the database authorization error in the standard Result contract', async () => {
  const client = {
    rpc: async () => ({ data: null, error: { code: 'P0001', message: 'FORBIDDEN' } }),
  } as unknown as SupabaseClient<any>;

  const result = await createBackendApi(client).getAdminDemoMonth();

  assert.deepEqual(result, {
    ok: false,
    error: { code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없습니다.', retryable: false },
  });
});
