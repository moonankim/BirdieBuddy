import { Suspense } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RoomPage from '@/app/(user)/chat/[roomId]/page';
import ChatListPage from '@/app/(user)/chat/page';
import InboxPage from '@/app/inbox/page';
import { createMockChatApi, type MockChatApi } from '@/components/chat/api/mock';
import type { Result, RoomCatalogItem } from '@/lib/api/types';
import { accounts } from '@/lib/session';
import { renderApp } from '../helpers/render-app';

// 여기까지 읽었어요(PRD 4절, 자성P v3 R-1): 목 SDK 읽음 규칙과 팬 채팅방·방 목록·인박스 화면.
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/chat' }));
function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.code); return result.data; }
const network = { ok: false as const, error: { code: 'NETWORK_ERROR', message: '', retryable: true } };
const id = () => crypto.randomUUID();

async function latestVisibleId(api: MockChatApi, account = accounts.userB) {
  api.setActor(account);
  return unwrap(await api.getMessages({ roomId: 'room-1', limit: 50 })).items.at(-1)!.id;
}
/** 팬 B가 지금까지 읽은 뒤 인플루언서가 전체 메시지를 count개 보낸다. 보낸 메시지 ID를 돌려준다. */
async function readThenBroadcast(api: MockChatApi, count: number) {
  api.setActor(accounts.userB);
  unwrap(await api.markRoomRead({ roomId: 'room-1', lastReadMessageId: await latestVisibleId(api) }));
  api.setActor(accounts.influencer);
  const ids: string[] = [];
  for (let index = 1; index <= count; index++) ids.push(unwrap(await api.sendBroadcast({ requestId: id(), roomId: 'room-1', body: `새 소식 ${index}` })).id);
  return ids;
}
function renderRoom(api: MockChatApi) {
  // 이미 끝난 Promise로 표시해 React use()가 일시 중단 없이 바로 값을 읽게 한다.
  const value = { roomId: 'room-1' };
  const params = Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
  return renderApp(<Suspense fallback={<p>로딩</p>}><RoomPage params={params} /></Suspense>, api, 'userB');
}

describe('mock read-state SDK', () => {
  it('starts without a divider, counts only new influencer messages, never moves the cursor back and skips deleted ones', async () => {
    const api = createMockChatApi();
    api.setActor(accounts.userB);
    expect(unwrap(await api.getRoomReadState({ roomId: 'room-1' }))).toMatchObject({ lastReadMessageId: null, firstUnreadMessageId: null, unreadCount: 0 });

    const [first, second] = await readThenBroadcast(api, 2);
    api.setActor(accounts.userB);
    unwrap(await api.submitMessage({ requestId: id(), roomId: 'room-1', body: '내 질문이에요' }));
    expect(unwrap(await api.getRoomReadState({ roomId: 'room-1' }))).toMatchObject({ firstUnreadMessageId: first, unreadCount: 2 });
    expect(unwrap(await api.getRooms()).items.find((room) => room.roomId === 'room-1')?.unreadCount).toBe(2);

    const read = unwrap(await api.getRoomReadState({ roomId: 'room-1' })).lastReadMessageId!;
    expect(unwrap(await api.markRoomRead({ roomId: 'room-1', lastReadMessageId: '90071992547409930' })).lastReadMessageId).toBe(read);

    api.setActor(accounts.influencer);
    unwrap(await api.deleteInfluencerMessage({ requestId: id(), roomId: 'room-1', messageId: first }));
    api.setActor(accounts.userB);
    expect(unwrap(await api.getRoomReadState({ roomId: 'room-1' }))).toMatchObject({ firstUnreadMessageId: second, unreadCount: 1 });
  });

  it('treats the greeting on a first join as already read', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    api.setActor(accounts.userA);
    unwrap(await api.joinRoom({ requestId: id(), roomId: 'room-1' }));
    expect(unwrap(await api.getRoomReadState({ roomId: 'room-1' }))).toMatchObject({ firstUnreadMessageId: null, unreadCount: 0 });
    expect(unwrap(await api.getRooms()).items.find((room) => room.roomId === 'room-1')?.unreadCount).toBe(0);
  });

  it('marks unanswered questions after the last inbox check as NEW', async () => {
    const api = createMockChatApi();
    api.setActor(accounts.userB);
    const asked = unwrap(await api.submitMessage({ requestId: id(), roomId: 'room-1', body: '드라이버 연습 질문' }));
    if (asked.verdict !== 'pass') throw new Error('not passed');
    api.setActor(accounts.influencer);
    const before = unwrap(await api.getRoomInbox({ roomId: 'room-1' }));
    expect(before.newCount).toBe(1);
    expect(before.items.find((item) => item.kind === 'question' && item.question.id === asked.message.id)?.isNew).toBe(true);
    unwrap(await api.markInboxChecked({ roomId: 'room-1', lastCheckedMessageId: before.checkedThroughMessageId }));
    expect(unwrap(await api.getInboxReadState({ roomId: 'room-1' })).lastCheckedMessageId).toBe(before.checkedThroughMessageId);
    const after = unwrap(await api.getRoomInbox({ roomId: 'room-1' }));
    expect(after.newCount).toBe(0);
    expect(after.items.every((item) => !item.isNew)).toBe(true);
  });
});

describe('fan chat room divider', () => {
  it('opens at the first unread message with a divider, offers the jump-to-latest button and saves the read position', async () => {
    const api = createMockChatApi();
    const [first, second] = await readThenBroadcast(api, 2);
    const mark = vi.spyOn(api, 'markRoomRead');
    renderRoom(api);
    const divider = await screen.findByRole('separator', { name: '여기까지 읽었어요' });
    expect(divider.nextElementSibling).toHaveTextContent('새 소식 1');
    expect(screen.getByRole('button', { name: '이전 메시지 더 보기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '최신 메시지로' })).toBeVisible();
    await waitFor(() => expect(mark).toHaveBeenCalledWith({ roomId: 'room-1', lastReadMessageId: second }));
    expect(first).not.toBe(second);
  });

  it('opens at the latest messages without a divider when nothing is unread', async () => {
    const api = createMockChatApi();
    renderRoom(api);
    expect(await screen.findByText('기본 자세부터 차근차근 연습해 보세요.')).toBeVisible();
    expect(screen.queryByRole('separator', { name: '여기까지 읽었어요' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 메시지로' })).not.toBeInTheDocument();
  });

  it('falls back to the latest messages without a divider when the read position cannot be loaded', async () => {
    const api = createMockChatApi();
    await readThenBroadcast(api, 1);
    api.getRoomReadState = async () => network;
    renderRoom(api);
    expect(await screen.findByText('새 소식 1')).toBeVisible();
    expect(screen.queryByRole('separator', { name: '여기까지 읽었어요' })).not.toBeInTheDocument();
  });

  it('loads from the first unread message when it is older than the latest page and jumps to the latest on request', async () => {
    const api = createMockChatApi();
    await readThenBroadcast(api, 60);
    const mock = vi.spyOn(api, 'getMessages');
    renderRoom(api);
    expect(await screen.findByText('새 소식 1')).toBeVisible();
    // 첫 화면은 최신 50개가 아니라 첫 안 읽은 메시지 다음부터 불러온다(뒤쪽은 이어 불러오기·실시간 복구로 채워진다).
    expect(mock.mock.calls[0]?.[0]).toMatchObject({ roomId: 'room-1', limit: 50, afterId: expect.any(String) });
    expect(screen.getByRole('button', { name: '다음 메시지 더 보기' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '최신 메시지로' }));
    expect(await screen.findByText('새 소식 60')).toBeVisible();
    expect(screen.queryByRole('button', { name: '다음 메시지 더 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('separator', { name: '여기까지 읽었어요' })).toBeInTheDocument();
  });
});

describe('room list unread badge', () => {
  it('shows 1~99, caps at 99+, and hides 0 or unknown counts', async () => {
    const api = createMockChatApi();
    const getRooms = api.getRooms.bind(api);
    const counts = [1, 99, 100, 0, null];
    api.getRooms = async () => {
      const result = await getRooms();
      if (!result.ok) return result;
      const items: RoomCatalogItem[] = result.data.items.slice(0, counts.length).map((room, index) => ({ ...room, unreadCount: counts[index] }));
      return { ok: true, data: { ...result.data, items } };
    };
    renderApp(<ChatListPage />, api, 'userB');
    expect(await screen.findByLabelText('안 읽은 메시지 1개')).toHaveTextContent('1');
    expect(screen.getByLabelText('안 읽은 메시지 99개')).toHaveTextContent('99');
    expect(screen.getByLabelText('안 읽은 메시지 99개 이상')).toHaveTextContent('99+');
    expect(screen.queryByLabelText(/안 읽은 메시지 0개/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/안 읽은 메시지/)).toHaveLength(3);
  });
});

describe('influencer inbox NEW', () => {
  it('shows NEW and the new-question count, saves the check, and keeps NEW while the inbox stays open', async () => {
    const api = createMockChatApi();
    api.setActor(accounts.userB);
    unwrap(await api.submitMessage({ requestId: id(), roomId: 'room-1', body: '퍼팅 거리감 질문' }));
    const mark = vi.spyOn(api, 'markInboxChecked');
    renderApp(<InboxPage />, api, 'influencer');
    expect(await screen.findByText((_, node) => node?.tagName === 'P' && node.textContent === '지난 확인 이후 새 질문 1건')).toBeVisible();
    const card = (await screen.findByText('퍼팅 거리감 질문')).closest('article')!;
    expect(within(card).getByText('NEW')).toBeVisible();
    await waitFor(() => expect(mark).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('checkbox', { name: /답변 완료 포함/ }));
    const reloaded = (await screen.findByText('퍼팅 거리감 질문')).closest('article')!;
    expect(within(reloaded).getByText('NEW')).toBeVisible();
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('hides NEW and the count when the inbox cannot be loaded', async () => {
    const api = createMockChatApi();
    api.getRoomInbox = async () => network;
    renderApp(<InboxPage />, api, 'influencer');
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText(/지난 확인 이후 새 질문/)).not.toBeInTheDocument();
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });
});

describe('room list entry link', () => {
  it('links to a room the fan is already in although canJoin is false, like the real server', async () => {
    const api = createMockChatApi();
    api.setActor(accounts.userB);
    expect(unwrap(await api.getRooms()).items.find((room) => room.roomId === 'room-1')).toMatchObject({ joinReason: 'already_active', canJoin: false });
    renderApp(<ChatListPage />, api, 'userB');
    expect(await screen.findByRole('link', { name: /들어가기/ })).toHaveAttribute('href', '/chat/room-1');
  });
});
