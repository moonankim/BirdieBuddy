import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/(user)/home/page';
import DrawPage from '@/app/(user)/draw/page';
import { readLastDraw, saveLastDraw } from '@/app/(user)/_lib/cards';
import { createMockChatApi } from '@/components/chat/api/mock';
import type { CompleteRoundData, Result } from '@/lib/api/types';
import { accounts } from '@/lib/session';
import { renderApp } from '../helpers/render-app';

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/home' }));
function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.code); return result.data; }
afterEach(() => { sessionStorage.clear(); router.push.mockClear(); });
const sampleDraw: CompleteRoundData = { roundId: 'r', drawId: 'd', grade: 'rare', isNew: true, ownedCount: 1, entryUnlocked: true,
  template: { id: 'tpl-2-retro', influencerId: 'influencer-2', influencerName: '인플루언서 2', influencerType: 'youtuber', verifiedAt: null, style: 'retro', imageUrl: '' } };
// 테스트 로그인은 session-reset을 보내 저장된 발급 결과를 지우므로, 그 직후(로그인 완료 전)에 저장한다.
function saveAfterSignIn(userId: string, data: CompleteRoundData) { window.addEventListener('session-reset', () => saveLastDraw(userId, data), { once: true }); }

describe('mock card SDK', () => {
  it('returns 30 templates with owned counts and only owned rows for getOwnedCards', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userA);
    const collection = unwrap(await api.getCollection()).items;
    expect(collection).toHaveLength(30);
    expect(collection.find((item) => item.template.id === 'tpl-1-illust')).toMatchObject({ totalCards: 10, highestGrade: 'common', counts: { common: 10 } });
    expect(unwrap(await api.getOwnedCards()).items).toEqual([expect.objectContaining({ grade: 'common', count: 10 })]);
    api.setActor(accounts.influencer);
    expect(await api.getCollection()).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('completes a round idempotently and unlocks room entry on the fifth card of an influencer', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userA);
    const random = vi.spyOn(Math, 'random');
    const before = unwrap(await api.getMyRoundGaugeSummary()).monthlyRoundCount;
    let last;
    for (let index = 0; index < 5; index++) {
      random.mockReturnValueOnce(3.5 / 30).mockReturnValueOnce(0); // tpl-2-illust, common
      last = unwrap(await api.completeRound({ requestId: `round-${index}` }));
      expect(last.entryUnlocked).toBe(index === 4);
      expect(last.isNew).toBe(index === 0);
    }
    expect(last).toMatchObject({ template: { influencerId: 'influencer-2' }, grade: 'common', ownedCount: 5 });
    expect(await api.completeRound({ requestId: 'round-4' })).toEqual({ ok: true, data: last });
    expect(unwrap(await api.getMyRoundGaugeSummary()).monthlyRoundCount).toBe(before + 5);
    expect(unwrap(await api.getRooms()).items.find((room) => room.roomId === 'room-2')).toMatchObject({ earnedCards: 5, canJoin: true });
  });
});

describe('home and draw screens', () => {
  it('home shows the month summary and owned cards, and round completion goes to /draw with the saved result', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    renderApp(<HomePage />, api, 'userA');
    expect(await screen.findByText('일러스트 · 10장')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /라운드 완료/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/draw'));
    expect(sessionStorage.getItem('birdiebuddy-last-draw:userA')).toContain('"roundId"');
  });

  it('draw shows the confirmed card and links to the unlocked chat room', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    saveAfterSignIn('userA', sampleDraw);
    renderApp(<DrawPage />, api, 'userA');
    expect(await screen.findByText('새 카드')).toBeVisible();
    expect(screen.getByText(/레트로 · 레어/)).toBeVisible();
    await waitFor(() => expect(screen.getByRole('link', { name: '채팅방으로 가기' })).toHaveAttribute('href', '/chat/room-2'));
    expect(screen.getByText('카드를 5장 모아 채팅방이 열렸어요.')).toBeVisible();
  });

  it('draw entry notice follows the room requiredCards setting instead of a fixed number', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const getRooms = api.getRooms.bind(api);
    api.getRooms = async () => { const r = await getRooms(); return r.ok ? { ok: true, data: { ...r.data, items: r.data.items.map((room) => ({ ...room, requiredCards: 7 })) } } : r; };
    saveAfterSignIn('userA', sampleDraw);
    renderApp(<DrawPage />, api, 'userA');
    expect(await screen.findByText('카드를 7장 모아 채팅방이 열렸어요.')).toBeVisible();
  });

  it('keeps the last draw per account and clears it on session reset', async () => {
    saveLastDraw('userA', sampleDraw);
    expect(readLastDraw('userA')).toEqual(sampleDraw);
    expect(readLastDraw('userB')).toBeNull();
    window.dispatchEvent(new Event('session-reset'));
    expect(readLastDraw('userA')).toBeNull();

    saveAfterSignIn('userA', sampleDraw);
    renderApp(<DrawPage />, createMockChatApi({ emptyMessages: true }), 'userB');
    expect(await screen.findByText('아직 발급 결과가 없어요')).toBeVisible();
    expect(screen.queryByText('새 카드')).not.toBeInTheDocument();
  });

  it('after a lost response, the main button retries the same request and does not issue a second card', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userA);
    const before = unwrap(await api.getMyRoundGaugeSummary()).monthlyRoundCount;
    const complete = api.completeRound.bind(api);
    const requestIds: string[] = [];
    let lose = true;
    api.completeRound = async (input) => {
      requestIds.push(input.requestId);
      const result = await complete(input); // 서버는 처리했지만
      if (lose) { lose = false; return { ok: false, error: { code: 'NETWORK_ERROR', message: '', retryable: true } }; } // 응답이 유실됨
      return result;
    };
    renderApp(<HomePage />, api, 'userA');
    await userEvent.click(await screen.findByRole('button', { name: /라운드 완료/ }));
    await userEvent.click(await screen.findByRole('button', { name: /발급 다시 시도/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/draw'));
    expect(requestIds).toHaveLength(2);
    expect(new Set(requestIds).size).toBe(1);
    api.setActor(accounts.userA);
    expect(unwrap(await api.getMyRoundGaugeSummary()).monthlyRoundCount).toBe(before + 1);
  });
});
