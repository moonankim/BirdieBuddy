import { describe, expect, it, vi } from 'vitest';
import { createMockChatApi } from '@/components/chat/api/mock';
import type { Result } from '@/components/chat/api/types';
import { accounts } from '@/lib/session';

function unwrap<T>(result: Result<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Unexpected ${result.error.code}`);
  return result.data;
}
const request = (body: string) => ({ requestId: crypto.randomUUID(), roomId: 'room-1', body });
async function suggestion(api: ReturnType<typeof createMockChatApi>) {
  // The rewrite still contains one mock moderation marker. This distinguishes token
  // bypass from ordinary re-evaluation, which must return suggest for this body.
  const result = unwrap(await api.submitMessage(request('[suggest] [suggest] 질문')));
  expect(result.verdict).toBe('suggest');
  if (result.verdict !== 'suggest' || !result.rewrite || !result.suggestionToken || !result.expiresAt) {
    throw new Error('Expected a usable suggestion');
  }
  return { input: { ...request(result.rewrite), suggestionToken: result.suggestionToken }, expiresAt: result.expiresAt };
}

describe('mock message identity and verdict contract', () => {
  it('creates one message for concurrent submissions of the same request and rejects a changed payload', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    const input = request('질문');
    const results = await Promise.all([api.submitMessage(input), api.submitMessage(input)]);
    expect(results[1]).toEqual(results[0]);
    expect(unwrap(await api.getMessages({ roomId: 'room-1' })).items).toHaveLength(1);
    expect(await api.submitMessage({ ...input, body: '다른 질문' })).toMatchObject({
      ok: false, error: { code: 'IDEMPOTENCY_CONFLICT', retryable: false },
    });
  });

  it('scopes request identity by operation as well as actor', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    const input = request('질문');
    unwrap(await api.joinRoom({ requestId: input.requestId, roomId: input.roomId }));
    expect(await api.submitMessage(input)).toMatchObject({ ok: true, data: { verdict: 'pass' } });
  });

  it.each(['pass', 'suggest', 'suggest-null', 'block'] as const)('returns %s without storing non-pass messages', async (kind) => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    const value = unwrap(await api.submitMessage(request(kind === 'pass' ? '질문' : `[${kind}] 질문`)));
    expect(value.verdict).toBe(kind === 'suggest-null' ? 'suggest' : kind);
    if (kind === 'suggest-null') expect(value.rewrite).toBeNull();
    if (kind === 'suggest') expect(value.rewrite).toBeTruthy();
    expect(unwrap(await api.getMessages({ roomId: 'room-1' })).items).toHaveLength(kind === 'pass' ? 1 : 0);
  });

  it('separates one-off transport failure injection from persistent [fail] moderation failure', async () => {
    const api = createMockChatApi({ emptyMessages: true, failOnce: 'NETWORK_ERROR' }); api.setActor(accounts.userB);
    const input = request('질문');
    expect(await api.submitMessage(input)).toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR', retryable: true } });
    expect(await api.submitMessage(input)).toMatchObject({ ok: true, data: { verdict: 'pass' } });
    const persistent = request('[fail] 질문');
    for (let count = 0; count < 2; count++) {
      expect(await api.submitMessage(persistent)).toMatchObject({ ok: false, error: { code: 'FILTER_UNAVAILABLE', retryable: true } });
    }
    expect(unwrap(await api.getMessages({ roomId: 'room-1' })).items).toHaveLength(1);
  });

  it('keeps userB supportBadge none in both the room catalog and stored question', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    expect(unwrap(await api.getRooms()).items.find((room) => room.roomId === 'room-1')?.supportBadge).toBe('none');
    expect(unwrap(await api.submitMessage(request('질문')))).toMatchObject({ verdict: 'pass', message: { supportBadge: 'none' } });
  });

  it('includes missingCards and card totals in admission failure details', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    expect(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-2' })).toMatchObject({
      ok: false, error: { code: 'INSUFFICIENT_CARDS', retryable: false, details: {
        requiredCards: 5, earnedCards: 0, missingCards: 5,
      } },
    });
  });

  it('includes current-month round count in readmission failure details', async () => {
    const api = createMockChatApi({ emptyMessages: true, initialUserBStatus: 'left', initialMonthlyRoundCount: 0 });
    api.setActor(accounts.userB);
    expect(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' })).toMatchObject({
      ok: false, error: { code: 'REJOIN_NOT_AVAILABLE', retryable: false, details: {
        requiredRoundsThisMonth: 3, monthlyRoundCount: 0,
      } },
    });
  });

  it('readmits an eligible former member with gauge 50 after three monthly rounds', async () => {
    const api = createMockChatApi({ emptyMessages: true, initialUserBStatus: 'left', initialMonthlyRoundCount: 3 });
    api.setActor(accounts.userB);
    expect(unwrap(await api.getRooms()).items.find((room) => room.roomId === 'room-1')?.joinReason).toBe('eligible');
    expect(unwrap(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' })))
      .toMatchObject({ membership: { status: 'active', gauge: 50 } });
  });
});

describe('mock suggestion lifecycle', () => {
  it('accepts an unchanged valid token once and returns the same message on retry of that submission', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    const { input } = await suggestion(api);
    const first = unwrap(await api.submitMessage(input));
    expect(first).toMatchObject({ verdict: 'pass', message: { body: input.body } });
    expect(await api.submitMessage(input)).toEqual({ ok: true, data: first });
    expect(unwrap(await api.getMessages({ roomId: 'room-1' })).items).toHaveLength(1);
    expect(await api.submitMessage({ ...input, requestId: crypto.randomUUID() }))
      .not.toMatchObject({ ok: true, data: { verdict: 'pass' } });
    expect(unwrap(await api.getMessages({ roomId: 'room-1' })).items).toHaveLength(1);
  });

  it('allows the valid token immediately before expiry', async () => {
    vi.useFakeTimers();
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    const { expiresAt, input } = await suggestion(api);
    vi.setSystemTime(new Date(Date.parse(expiresAt) - 1));
    expect(await api.submitMessage(input)).toMatchObject({ ok: true, data: { verdict: 'pass' } });
  });

  it.each([0, 1])('re-evaluates the body at expiry +%d ms without reusing the token bypass', async (offset) => {
    vi.useFakeTimers();
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    const { expiresAt, input } = await suggestion(api);
    vi.setSystemTime(new Date(Date.parse(expiresAt) + offset));
    expect(await api.submitMessage(input)).toMatchObject({ ok: true, data: { verdict: 'suggest' } });
    expect(unwrap(await api.getMessages({ roomId: 'room-1' })).items).toHaveLength(0);
  });

  it('does not let another account consume the original account token', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    const { input } = await suggestion(api);
    api.setActor(accounts.userA);
    unwrap(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' }));
    expect(await api.submitMessage(input)).not.toMatchObject({ ok: true, data: { verdict: 'pass' } });
    const userAMessages = unwrap(await api.getMessages({ roomId: 'room-1' })).items;
    expect(userAMessages.filter((item) => item.messageKind === 'user_question')).toHaveLength(0);
    api.setActor(accounts.userB);
    expect(await api.submitMessage(input)).toMatchObject({ ok: true, data: { verdict: 'pass' } });
  });
});

describe('mock visibility and recovery', () => {
  it('keeps fan questions and private greetings separate while the owner sees both questions', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userA);
    unwrap(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' }));
    unwrap(await api.submitMessage(request('팬 A 질문')));
    api.setActor(accounts.userB);
    unwrap(await api.submitMessage(request('팬 B 질문')));
    const userBMessages = unwrap(await api.getMessages({ roomId: 'room-1' })).items;
    expect(userBMessages.map((item) => item.body)).toEqual(['팬 B 질문']);
    api.setActor(accounts.userA);
    const userAMessages = unwrap(await api.getMessages({ roomId: 'room-1' })).items;
    expect(userAMessages.filter((item) => item.messageKind === 'user_question').map((item) => item.body)).toEqual(['팬 A 질문']);
    expect(userAMessages.some((item) => item.messageKind === 'greeting')).toBe(true);
    api.setActor(accounts.influencer);
    expect(unwrap(await api.getRoomInbox({ roomId: 'room-1' })).items.map((item) => item.kind === 'question' ? item.question.body : item.representative))
      .toEqual(expect.arrayContaining(['팬 A 질문', '팬 B 질문']));
    api.setActor(accounts.admin);
    expect(await api.getMessages({ roomId: 'room-1' })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('recovers a deletion of an old row outside the newest 100 messages using its updatedAt/id cursor', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.influencer);
    const snapshots = [];
    for (let index = 0; index < 101; index++) {
      snapshots.push({ ...unwrap(await api.sendBroadcast(request(`방송 ${index}`))) });
    }
    const old = snapshots[0]; const last = snapshots[snapshots.length - 1];
    api.dropConnection();
    const deleted = unwrap(await api.deleteInfluencerMessage({
      requestId: crypto.randomUUID(), roomId: 'room-1', messageId: old.id,
    })).message;
    api.setActor(accounts.userB);
    const recovered = unwrap(await api.reconcileRoomMessages({
      roomId: 'room-1', currentMessages: snapshots, updatedAfter: last.updatedAt, afterId: last.id,
    }));
    expect(recovered.messages).toHaveLength(101);
    expect(recovered.messages.find((item) => item.id === old.id)).toMatchObject({ body: null, deletedAt: deleted.deletedAt });
    expect(recovered.updatedAfter).toBe(deleted.updatedAt);
    expect(recovered.afterId).toBe(old.id);
  });

  it('recovers every unseen message instead of truncating recovery to the latest 100', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.influencer);
    for (let index = 0; index < 101; index++) unwrap(await api.sendBroadcast(request(`방송 ${index}`)));
    api.setActor(accounts.userB);
    expect(unwrap(await api.reconcileRoomMessages({ roomId: 'room-1', currentMessages: [] })).messages).toHaveLength(101);
  });
});
