import { describe, expect, it } from 'vitest';
import { createMockChatApi } from '@/components/chat/api/mock';
import type { Result } from '@/lib/api/types';
import { accounts } from '@/lib/session';

function unwrap<T>(value: Result<T>): T {
  expect(value.ok).toBe(true);
  if (!value.ok) throw new Error(value.error.code);
  return value.data;
}
function nextMonth(month: string) {
  const next = new Date(`${month}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 10);
}

describe('demo month settlement and readmission', () => {
  it.each([0, 2, 4])('skips joinedMonth settlement for %d rounds (entry/reentry month policy)', async (rounds) => {
    const api = createMockChatApi({ emptyMessages: true, initialMonthlyRoundCount: rounds });
    api.setActor(accounts.userB);
    const membership = unwrap(await api.getMyMembership({ roomId: 'room-1' }));
    api.setActor(accounts.admin);
    const result = unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
    expect(result.closedMonth).toBe(membership?.joinedMonth);
    expect(result.members.find((member) => member.userId === 'userB')).toMatchObject({ previousGauge: 50, gauge: 50, roundCount: rounds });
  });

  it.each([[2, 37.5], [3, 50]])('settles %d rounds to gauge %d after the entry month has closed', async (rounds, gauge) => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.admin);
    unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
    for (let count = 0; count < rounds; count++) api.completeMockRound('userB');
    const result = unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
    expect(result.members.find((member) => member.userId === 'userB')).toMatchObject({ previousGauge: 50, gauge, roundCount: rounds });
  });

  it('skips entry month, settles 50→12.5→0, then requires three new monthly rounds to rejoin at 50', async () => {
    const api = createMockChatApi(); api.setActor(accounts.admin);
    for (const gauge of [50, 12.5, 0]) {
      const result = unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
      expect(result.members.find((member) => member.userId === 'userB')).toMatchObject({
        gauge, status: gauge === 0 ? 'left' : 'active', roundCount: 0,
      });
    }
    api.setActor(accounts.userB);
    expect(unwrap(await api.getMyMembership({ roomId: 'room-1' }))).toMatchObject({ status: 'left', gauge: 0 });
    for (let round = 0; round < 2; round++) api.completeMockRound('userB');
    expect(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' })).toMatchObject({
      ok: false, error: { code: 'REJOIN_NOT_AVAILABLE', details: { monthlyRoundCount: 2 } },
    });
    api.completeMockRound('userB');
    const joined = unwrap(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' }));
    expect(joined).toMatchObject({ membership: { status: 'active', gauge: 50 }, welcomeMessage: null });
    const messages = unwrap(await api.getMessages({ roomId: 'room-1' })).items;
    expect(messages.filter((message) => message.messageKind === 'greeting')).toHaveLength(1);
  });

  it('returns applied=false for the same targetMonth with a new ID and does not settle twice', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.admin);
    const input = { requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) };
    const first = unwrap(await api.advanceDemoMonth(input));
    expect(await api.advanceDemoMonth(input)).toEqual({ ok: true, data: first });
    const duplicate = unwrap(await api.advanceDemoMonth({ ...input, requestId: crypto.randomUUID() }));
    expect(duplicate).toEqual({ ...first, applied: false });
    expect(api.getMockDemoMonth()).toBe(input.targetMonth);
    api.setActor(accounts.userB);
    expect(unwrap(await api.getMyMembership({ roomId: 'room-1' }))).toMatchObject({ gauge: 50, status: 'active' });
  });

  it('adds 12.5 per round above the monthly target and clamps the resulting gauge to 100', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.admin);
    unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
    for (let round = 0; round < 4; round++) api.completeMockRound('userB');
    const first = unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
    expect(first.members.find((member) => member.userId === 'userB')).toMatchObject({ gauge: 62.5, roundCount: 4 });
    for (let round = 0; round < 8; round++) api.completeMockRound('userB');
    const second = unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
    expect(second.members.find((member) => member.userId === 'userB')?.gauge).toBe(100);
  });

  it('also skips a real readmission month when the user plays four rounds', async () => {
    const api = createMockChatApi({ emptyMessages: true, initialUserBStatus: 'left', initialMonthlyRoundCount: 3 });
    api.setActor(accounts.userB);
    const joined = unwrap(await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' }));
    api.completeMockRound('userB');
    api.setActor(accounts.admin);
    const result = unwrap(await api.advanceDemoMonth({ requestId: crypto.randomUUID(), targetMonth: nextMonth(api.getMockDemoMonth()) }));
    expect(result.closedMonth).toBe(joined.membership.joinedMonth);
    expect(result.members.find((member) => member.userId === 'userB')).toMatchObject({ previousGauge: 50, gauge: 50, roundCount: 4 });
  });
});
