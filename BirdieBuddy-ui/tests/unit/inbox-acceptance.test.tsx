import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InboxPage from '@/app/inbox/page';
import { createMockChatApi } from '@/components/chat/api/mock';
import type { InboxItem, Page, Result } from '@/components/chat/api/types';
import { accounts } from '@/lib/session';
import { deferred, message } from '../helpers/chat';
import { renderApp } from '../helpers/render-app';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const network = { ok: false as const, error: { code: 'NETWORK_ERROR', message: '', retryable: true } };
const page = (items: InboxItem[], nextCursor: string | null = null): Result<Page<InboxItem>> => ({ ok: true, data: { items, nextCursor } });
const question = (id: string, body = `질문 ${id}`): InboxItem => ({
  ...message(id, { senderId: 'userB', senderType: 'user', messageKind: 'user_question', body }),
  answered: false, replyId: null, passesAllFilters: true,
});

describe('inbox completed user actions', () => {
  it('loads more than 50 questions using the cursor and resets the page when answered inclusion changes', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    for (let index = 0; index < 51; index++) {
      expect((await api.submitMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', body: `페이지 질문 ${index}` })).ok).toBe(true);
    }
    const read = vi.spyOn(api, 'getRoomInbox');
    renderApp(<InboxPage />, api);
    await screen.findByText('페이지 질문 50', { exact: true });
    expect(screen.getAllByRole('button', { name: '답변하기' })).toHaveLength(50);
    const cursor = (await read.mock.results[0].value);
    if (!cursor.ok) throw new Error('Expected first page');
    await userEvent.click(screen.getByRole('button', { name: '더 보기' }));
    await screen.findByText('페이지 질문 0', { exact: true });
    expect(screen.getAllByRole('button', { name: '답변하기' })).toHaveLength(51);
    expect(read.mock.calls[1][0].cursor).toBe(cursor.data.nextCursor);
    await userEvent.click(screen.getByRole('checkbox', { name: '답변 완료 포함' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: '답변하기' })).toHaveLength(50));
    expect(screen.queryByText('페이지 질문 0', { exact: true })).not.toBeInTheDocument();
    expect(read).toHaveBeenLastCalledWith({ roomId: 'room-1', includeAnswered: true, limit: 50 });
  });

  it('ignores a late initial page after the answered filter has already loaded a new page', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const old = deferred<Result<Page<InboxItem>>>();
    vi.spyOn(api, 'getRoomInbox').mockReturnValueOnce(old.promise).mockResolvedValue(page([question('99', '새 조건 질문')]));
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('checkbox', { name: '답변 완료 포함' }));
    await screen.findByText('새 조건 질문');
    await act(async () => { old.resolve(page([question('1', '이전 조건 질문')])); });
    expect(screen.getByText('새 조건 질문')).toBeVisible();
    expect(screen.queryByText('이전 조건 질문')).not.toBeInTheDocument();
  });

  it('ignores an old load-more response after the answered toggle resets the cursor', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const older = deferred<Result<Page<InboxItem>>>();
    vi.spyOn(api, 'getRoomInbox').mockImplementation((input) => input.cursor ? older.promise : Promise.resolve(
      input.includeAnswered ? page([question('99', '새 조건 질문')]) : page([question('2')], 'old-cursor'),
    ));
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '더 보기' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '답변 완료 포함' }));
    await screen.findByText('새 조건 질문');
    await act(async () => { older.resolve(page([question('1', '이전 페이지 추가행')])); });
    expect(screen.queryByText('이전 페이지 추가행')).not.toBeInTheDocument();
    expect(screen.getByText('새 조건 질문')).toBeVisible();
  });

  it('shows a block-count error and retries it without preventing the inbox from rendering', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const original = api.getRoomDailyBlockCount.bind(api);
    const read = vi.spyOn(api, 'getRoomDailyBlockCount').mockResolvedValueOnce(network).mockImplementation(original);
    vi.spyOn(api, 'getRoomInbox').mockResolvedValue(page([question('1')]));
    renderApp(<InboxPage />, api);
    await screen.findByText('질문 1');
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('오늘 AI가 0건을 걸러냈어요')).toBeVisible();
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getByText('질문 1')).toBeVisible();
  });

  it('keeps deletion error and same-ID retry inside the open confirmation dialog', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.influencer);
    const sent = await api.sendBroadcast({ requestId: crypto.randomUUID(), roomId: 'room-1', body: '삭제 대상' });
    expect(sent.ok).toBe(true);
    const original = api.deleteInfluencerMessage.bind(api);
    const remove = vi.spyOn(api, 'deleteInfluencerMessage').mockResolvedValueOnce(network).mockImplementation(original);
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
    const dialog = await screen.findByRole('dialog', { name: '메시지 삭제' });
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('연결이 불안정해요.');
    await userEvent.click(await within(dialog).findByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(dialog).not.toBeVisible());
    expect(remove.mock.calls[1][0]).toEqual(remove.mock.calls[0][0]);
    expect(screen.getByText('삭제된 메시지')).toBeVisible();
    // jsdom does not enforce the browser's inert behavior; DOM containment above
    // verifies the retry remains inside the modal's interactive subtree.
  });

  it('does not carry a failed deletion error from a cancelled dialog into the next message dialog', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.influencer);
    for (const body of ['삭제 대상 A', '삭제 대상 B']) {
      expect((await api.sendBroadcast({ requestId: crypto.randomUUID(), roomId: 'room-1', body })).ok).toBe(true);
    }
    vi.spyOn(api, 'deleteInfluencerMessage').mockResolvedValue(network);
    renderApp(<InboxPage />, api);
    await screen.findByText('삭제 대상 A');
    const opener = () => screen.getAllByRole('button', { name: '삭제' });
    await userEvent.click(opener()[0]);
    let dialog = await screen.findByRole('dialog', { name: '메시지 삭제' });
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    expect(await within(dialog).findByRole('alert')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: /취소|닫기/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '메시지 삭제' })).not.toBeInTheDocument());
    await userEvent.click(opener()[1]);
    dialog = await screen.findByRole('dialog', { name: '메시지 삭제' });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  for (const outcome of ['retry succeeds', 'ALREADY_REPLIED'] as const) {
    it(`removes the group reply form after a failed group reply then ${outcome}`, async () => {
      const api = createMockChatApi({ emptyMessages: true });
      vi.spyOn(api, 'getRoomInbox').mockResolvedValue(page([question('2', '현재 페이지 질문')]));
      vi.spyOn(api, 'clusterQuestions').mockResolvedValue({ ok: true, data: { roomId: 'room-1', clusters: [
        { id: 'cluster-1', representative: '묶음 대표', memberCount: 2, messageIds: ['1', '2'] },
      ] } });
      const second = outcome === 'retry succeeds'
        ? { ok: true as const, data: message('3', { messageKind: 'influencer_answer', body: '묶음 답변', replyTo: '1', clusterId: 'cluster-1' }) }
        : { ok: false as const, error: { code: 'ALREADY_REPLIED', message: '', retryable: false } };
      const reply = vi.spyOn(api, 'replyToMessage').mockResolvedValueOnce(network).mockResolvedValueOnce(second);
      renderApp(<InboxPage />, api);
      await userEvent.click(await screen.findByRole('button', { name: '비슷한 질문 묶기' }));
      const representative = await screen.findByText(/묶음 대표.*2명이 질문했어요/);
      const group = representative.closest('details');
      if (!group) throw new Error('Expected group details');
      await userEvent.click(representative);
      if (!within(group).queryByRole('textbox', { name: /답변/ })) {
        await userEvent.click(within(group).getByRole('button', { name: /답변하기|묶음 답변/ }));
      }
      await userEvent.type(await within(group).findByRole('textbox', { name: /답변/ }), '묶음 답변');
      await userEvent.click(within(group).getByRole('button', { name: /답변 보내기|묶음에 답변하기/ }));
      await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
      await waitFor(() => expect(reply).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText(/묶음 대표.*2명이 질문했어요/)).not.toBeInTheDocument());
    });
  }

  it('offers a group reply even when its first source question is outside the current page', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    vi.spyOn(api, 'getRoomInbox').mockResolvedValue(page([question('2', '현재 페이지 질문')]));
    vi.spyOn(api, 'clusterQuestions').mockResolvedValue({ ok: true, data: { roomId: 'room-1', clusters: [
      { id: 'cluster-1', representative: '묶음 대표', memberCount: 2, messageIds: ['1', '2'] },
    ] } });
    const reply = vi.spyOn(api, 'replyToMessage').mockResolvedValue({ ok: true, data: message('3', { messageKind: 'influencer_answer', body: '묶음 답변', replyTo: '1', clusterId: 'cluster-1' }) });
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '비슷한 질문 묶기' }));
    const representative = await screen.findByText(/묶음 대표.*2명이 질문했어요/);
    const group = representative.closest('details');
    if (!group) throw new Error('Expected group details');
    await userEvent.click(representative);
    if (!within(group).queryByRole('textbox', { name: /답변/ })) {
      await userEvent.click(within(group).getByRole('button', { name: /답변하기|묶음 답변/ }));
    }
    await userEvent.type(await within(group).findByRole('textbox', { name: /답변/ }), '묶음 답변');
    await userEvent.click(within(group).getByRole('button', { name: /답변 보내기|묶음에 답변하기/ }));
    await waitFor(() => expect(reply).toHaveBeenCalledTimes(1));
    expect(reply.mock.calls[0][0]).toMatchObject({ roomId: 'room-1', replyTo: '1', body: '묶음 답변' });
    await waitFor(() => expect(screen.queryByText(/묶음 대표.*2명이 질문했어요/)).not.toBeInTheDocument());
  });

  it('preserves the previous summary on failure and retries the same summary operation ID', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const data = { roomId: 'room-1', summary: '보존할 요약', sourceMessageIds: [], generatedAt: new Date().toISOString() };
    const summarize = vi.spyOn(api, 'summarizeRoom').mockResolvedValueOnce({ ok: true, data })
      .mockResolvedValueOnce(network).mockResolvedValueOnce({ ok: true, data: { ...data, summary: '재시도 요약' } });
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '대화 요약' }));
    await screen.findByText('보존할 요약');
    await userEvent.click(screen.getByRole('button', { name: '대화 요약' }));
    const retry = await screen.findByRole('button', { name: '재시도' });
    expect(screen.getByText('보존할 요약')).toBeVisible();
    await userEvent.click(retry);
    await screen.findByText('재시도 요약');
    expect(summarize.mock.calls[2][0]).toEqual(summarize.mock.calls[1][0]);
  });

  it('uses a stable keyset cursor after the cursor row is answered and removed from the unanswered list', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    for (let index = 0; index < 51; index++) await api.submitMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', body: `키셋 ${index}` });
    api.setActor(accounts.influencer);
    const first = await api.getRoomInbox({ roomId: 'room-1', limit: 50 });
    if (!first.ok || !first.data.nextCursor) throw new Error('Expected paginated inbox');
    const pivot = first.data.items[first.data.items.length - 1];
    expect((await api.replyToMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', replyTo: pivot.id, body: '답변' })).ok).toBe(true);
    const next = await api.getRoomInbox({ roomId: 'room-1', cursor: first.data.nextCursor, limit: 50 });
    if (!next.ok) throw new Error(next.error.code);
    expect(next.data.items.map((item) => item.body)).toEqual(['키셋 0']);
    const previousIds = new Set(first.data.items.map((item) => item.id));
    expect(next.data.items.some((item) => previousIds.has(item.id))).toBe(false);
  });
});
