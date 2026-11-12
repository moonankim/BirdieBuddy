import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InboxPage from '@/app/inbox/page';
import { createMockChatApi } from '@/components/chat/api/mock';
import type { InboxItem, InboxPage as InboxPageData, Result } from '@/lib/api/types';
import { accounts } from '@/lib/session';
import { deferred, message } from '../helpers/chat';
import { renderApp } from '../helpers/render-app';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const network = { ok: false as const, error: { code: 'NETWORK_ERROR', message: '', retryable: true } };
const page = (items: InboxItem[], nextCursor: string | null = null, revision = 'r1'): Result<InboxPageData> => ({ ok: true, data: { items, nextCursor, revision } });
const question = (id: string, body = `질문 ${id}`): InboxItem => ({
  kind: 'question', inboxKey: `question:${id}`, priority: 0, tieMessageId: id, replyTo: id, answered: false, replyId: null,
  expectedClusterId: null, expectedClusterVersion: null,
  question: message(id, { senderId: 'userB', senderType: 'user', messageKind: 'user_question', body }),
});
const cluster = (id = 'cluster-1', version = 1): InboxItem => ({
  kind: 'cluster', inboxKey: `cluster:${id}`, priority: 0, tieMessageId: '2', replyTo: '2', answered: false, replyId: null,
  expectedClusterId: id, expectedClusterVersion: version, clusterId: id, representative: '묶음 대표', memberCount: 2, activeMessageIds: ['1', '2'],
});
const answerMessage = message('3', { messageKind: 'influencer_answer', body: '묶음 답변', replyTo: '2', clusterId: 'cluster-1' });

async function openGroupReply() {
  await screen.findByText(/묶음 대표.*2명이 질문했어요/);
  await userEvent.click(screen.getByRole('button', { name: '묶음에 답변하기' }));
  await userEvent.type(await screen.findByRole('textbox', { name: '묶음 답변' }), '묶음 답변');
  await userEvent.click(screen.getByRole('button', { name: '답변 보내기' }));
}

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
    const old = deferred<Result<InboxPageData>>();
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
    const older = deferred<Result<InboxPageData>>();
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
    it(`retries a failed group reply with the same cluster ID/version and closes the form when ${outcome}`, async () => {
      const api = createMockChatApi({ emptyMessages: true });
      let done = false;
      vi.spyOn(api, 'getRoomInbox').mockImplementation(async () => page(done ? [] : [cluster()]));
      const second = outcome === 'retry succeeds'
        ? { ok: true as const, data: answerMessage }
        : { ok: false as const, error: { code: 'ALREADY_REPLIED', message: '', retryable: false } };
      const reply = vi.spyOn(api, 'replyToMessage').mockResolvedValueOnce(network).mockImplementationOnce(async () => { done = true; return second; });
      renderApp(<InboxPage />, api);
      await openGroupReply();
      await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
      await waitFor(() => expect(reply).toHaveBeenCalledTimes(2));
      expect(reply.mock.calls[1][0]).toEqual(reply.mock.calls[0][0]);
      expect(reply.mock.calls[0][0]).toMatchObject({ roomId: 'room-1', replyTo: '2', expectedClusterId: 'cluster-1', expectedClusterVersion: 1, body: '묶음 답변' });
      await waitFor(() => expect(screen.queryByText(/묶음 대표.*2명이 질문했어요/)).not.toBeInTheDocument());
    });
  }

  it('sends null cluster expectations for a single question', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    vi.spyOn(api, 'getRoomInbox').mockResolvedValue(page([question('5', '단일 질문')]));
    const reply = vi.spyOn(api, 'replyToMessage').mockResolvedValue({ ok: true, data: message('6', { messageKind: 'influencer_answer', replyTo: '5' }) });
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '답변하기' }));
    await userEvent.type(screen.getByRole('textbox', { name: '답변' }), '답변');
    await userEvent.click(screen.getByRole('button', { name: '답변 보내기' }));
    await waitFor(() => expect(reply).toHaveBeenCalledTimes(1));
    expect(reply.mock.calls[0][0]).toMatchObject({ replyTo: '5', expectedClusterId: null, expectedClusterVersion: null });
  });

  it('on SOURCE_CHANGED reloads the inbox, keeps the draft and requires a new send instead of a same-ID retry', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const read = vi.spyOn(api, 'getRoomInbox').mockResolvedValueOnce(page([cluster('cluster-1', 1)])).mockResolvedValue(page([cluster('cluster-1', 2)], null, 'r2'));
    const reply = vi.spyOn(api, 'replyToMessage')
      .mockResolvedValueOnce({ ok: false, error: { code: 'SOURCE_CHANGED', message: '', retryable: true } })
      .mockResolvedValue({ ok: true, data: answerMessage });
    renderApp(<InboxPage />, api);
    await openGroupReply();
    expect(await screen.findByText(/질문 목록이 바뀌어 다시 불러왔어요/)).toBeVisible();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '묶음 답변' })).toHaveValue('묶음 답변');
    await userEvent.click(screen.getByRole('button', { name: '답변 보내기' }));
    await waitFor(() => expect(reply).toHaveBeenCalledTimes(2));
    expect(reply.mock.calls[1][0].requestId).not.toBe(reply.mock.calls[0][0].requestId);
    expect(reply.mock.calls[1][0]).toMatchObject({ expectedClusterVersion: 2 });
  });

  it('restarts from the first page when load-more returns SOURCE_CHANGED', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const read = vi.spyOn(api, 'getRoomInbox').mockImplementation(async (input) => input.cursor
      ? { ok: false, error: { code: 'SOURCE_CHANGED', message: '', retryable: true } }
      : page([question('2', read.mock.calls.length > 1 ? '새 첫 페이지' : '옛 첫 페이지')], read.mock.calls.length > 1 ? null : 'cursor-1'));
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '더 보기' }));
    expect(await screen.findByText('새 첫 페이지')).toBeVisible();
    expect(screen.queryByText('옛 첫 페이지')).not.toBeInTheDocument();
    expect(screen.getByText(/질문 목록이 바뀌어 다시 불러왔어요/)).toBeVisible();
  });

  it('keeps line breaks of a plain-text summary', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    const summary = '팬들이 연습 방법을 물었어요.\n드라이버 비거리\n아이언 정확도';
    vi.spyOn(api, 'summarizeRoom').mockResolvedValue({ ok: true, data: { roomId: 'room-1', summary, sourceMessageIds: [], generatedAt: new Date().toISOString() } });
    renderApp(<InboxPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '대화 요약' }));
    const shown = await screen.findByText((_, element) => element?.textContent === summary);
    expect(shown).toHaveClass('whitespace-pre-line');
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

  it('rejects an old cursor with SOURCE_CHANGED after the inbox revision changes', async () => {
    const api = createMockChatApi({ emptyMessages: true }); api.setActor(accounts.userB);
    for (let index = 0; index < 51; index++) await api.submitMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', body: `키셋 ${index}` });
    api.setActor(accounts.influencer);
    const first = await api.getRoomInbox({ roomId: 'room-1', limit: 50 });
    if (!first.ok || !first.data.nextCursor) throw new Error('Expected paginated inbox');
    const pivot = first.data.items[first.data.items.length - 1];
    expect((await api.replyToMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', replyTo: pivot.replyTo, expectedClusterId: null, expectedClusterVersion: null, body: '답변' })).ok).toBe(true);
    expect(await api.getRoomInbox({ roomId: 'room-1', cursor: first.data.nextCursor, limit: 50 })).toMatchObject({ ok: false, error: { code: 'SOURCE_CHANGED' } });
    const fresh = await api.getRoomInbox({ roomId: 'room-1', limit: 100 });
    if (!fresh.ok) throw new Error(fresh.error.code);
    expect(fresh.data.items).toHaveLength(50);
    expect(fresh.data.items.some((item) => item.inboxKey === pivot.inboxKey)).toBe(false);
  });

  it('returns a cluster as one inbox row and rejects a stale cluster version', async () => {
    const api = createMockChatApi({ emptyMessages: true });
    api.setActor(accounts.userB);
    for (const body of ['드라이버 비거리 늘리는 법', '드라이버 비거리 팁']) await api.submitMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', body });
    api.setActor(accounts.influencer);
    const grouped = await api.clusterQuestions({ requestId: crypto.randomUUID(), roomId: 'room-1' });
    if (!grouped.ok || !grouped.data.clusters[0]) throw new Error('Expected a cluster');
    const inbox = await api.getRoomInbox({ roomId: 'room-1' });
    if (!inbox.ok) throw new Error(inbox.error.code);
    expect(inbox.data.items).toHaveLength(1);
    const row = inbox.data.items[0];
    if (row.kind !== 'cluster') throw new Error('Expected cluster row');
    expect(row).toMatchObject({ memberCount: 1, expectedClusterVersion: 1, activeMessageIds: grouped.data.clusters[0].messageIds });
    expect(await api.replyToMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', replyTo: row.replyTo, expectedClusterId: row.expectedClusterId, expectedClusterVersion: 2, body: '답변' }))
      .toMatchObject({ ok: false, error: { code: 'SOURCE_CHANGED' } });
    expect((await api.replyToMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', replyTo: row.replyTo, expectedClusterId: row.expectedClusterId, expectedClusterVersion: 1, body: '답변' })).ok).toBe(true);
  });
});
