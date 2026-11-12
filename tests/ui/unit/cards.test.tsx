import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/(user)/home/page';
import CollectionPage from '@/app/(user)/collection/page';
import DrawPage from '@/app/(user)/draw/page';
import { saveLastDraw } from '@/app/(user)/_lib/cards';
import { createMockChatApi } from '@/components/chat/api/mock';
import type { Result } from '@/lib/api/types';
import { accounts } from '@/lib/session';
import { renderApp } from '../helpers/render-app';

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/home' }));
function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.code); return result.data; }
afterEach(() => { sessionStorage.clear(); router.push.mockClear(); });

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

describe('home, collection and draw screens', () => {
  it('home shows the month summary and owned cards, and round completion goes to /draw with the saved result', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    renderApp(<HomePage />, api, 'userA');
    expect(await screen.findByText('일러스트 · 10장')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /라운드 완료/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/draw'));
    expect(sessionStorage.getItem('birdiebuddy-last-draw')).toContain('"roundId"');
  });

  it('collection lists owned and unowned templates and the owned tab shows only owned cards', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    renderApp(<CollectionPage />, api, 'userA');
    expect(await screen.findByText('1 / 30')).toBeVisible();
    expect(screen.getAllByText('아직 만나지 못했어요')).toHaveLength(29);
    await userEvent.click(screen.getByRole('button', { name: '보유 카드' }));
    expect(screen.queryByText('아직 만나지 못했어요')).not.toBeInTheDocument();
    expect(screen.getByText('10장 보유')).toBeVisible();
  });

  it('draw shows the confirmed card and links to the unlocked chat room', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    saveLastDraw({ roundId: 'r', drawId: 'd', grade: 'rare', isNew: true, ownedCount: 1, entryUnlocked: true,
      template: { id: 'tpl-2-retro', influencerId: 'influencer-2', influencerName: '인플루언서 2', influencerType: 'youtuber', verifiedAt: null, style: 'retro', imageUrl: '' } });
    renderApp(<DrawPage />, api, 'userA');
    expect(await screen.findByText('새 카드')).toBeVisible();
    expect(screen.getByText(/레트로 · 레어/)).toBeVisible();
    await waitFor(() => expect(screen.getByRole('link', { name: '채팅방으로 가기' })).toHaveAttribute('href', '/chat/room-2'));
  });
});
