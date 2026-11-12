import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatApiProvider, type ChatApi } from '@/components/chat/api/chat-api';
import { createMockChatApi } from '@/components/chat/api/mock';
import { accounts } from '@/lib/session';
import type { Message, Page, ReconcileRoomMessagesData, Result } from '@/components/chat/api/types';
import { mergeMessages, useRoomMessages } from '@/components/chat/use-room-messages';
import { deferred, message } from '../helpers/chat';

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const failure = (code: string) => ({ ok: false as const, error: { code, message: '', retryable: false } });
type Subscription = Parameters<ChatApi['subscribeRoomMessages']>[0];

function harness() {
  const subscriptions: Array<Subscription & { unsubscribe: ReturnType<typeof vi.fn> }> = [];
  const getMessages = vi.fn<ChatApi['getMessages']>().mockResolvedValue(ok({ items: [message('10')], nextCursor: null }));
  const reconcile = vi.fn<ChatApi['reconcileRoomMessages']>().mockImplementation(async (input) => ok({
    messages: [...input.currentMessages], checkpoint: { updatedAt: '2026-11-11T00:00:01.000Z', id: '10' },
  }));
  const subscribe = vi.fn<ChatApi['subscribeRoomMessages']>().mockImplementation((input) => {
    const unsubscribe = vi.fn(() => input.onStatus('CLOSED'));
    subscriptions.push({ ...input, unsubscribe });
    return unsubscribe;
  });
  const api: ChatApi = {
    ...createMockChatApi(), getMessages, reconcileRoomMessages: reconcile, subscribeRoomMessages: subscribe,
  };
  const wrapper = ({ children }: { children: ReactNode }) => <ChatApiProvider api={api}>{children}</ChatApiProvider>;
  const mount = (roomId = 'room-1') => renderHook(({ roomId }) => useRoomMessages(roomId), {
    wrapper, initialProps: { roomId },
  });
  const latest = () => subscriptions[subscriptions.length - 1];
  return { getMessages, reconcile, subscribe, subscriptions, latest, mount };
}

describe('mergeMessages', () => {
  it('sorts decimal string IDs numerically without losing bigint precision', () => {
    const ids = ['90071992547409931', '2', '90071992547409930', '10'];
    expect(mergeMessages([], ids.map((id) => message(id))).map((m) => m.id))
      .toEqual(['2', '10', '90071992547409930', '90071992547409931']);
  });

  it('replaces the same ID rather than appending a duplicate', () => {
    expect(mergeMessages([message('10')], [message('10', { body: '변경' })]))
      .toEqual([message('10', { body: '변경' })]);
  });

  it('replaces an existing row with a deletion tombstone', () => {
    const removed = message('10', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    expect(mergeMessages([message('10')], [removed])).toEqual([removed]);
  });

  it('keeps a newer tombstone when an older copy of the same ID arrives', () => {
    const removed = message('10', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    expect(mergeMessages([removed], [message('10')])).toEqual([removed]);
  });

  it('prefers a tombstone over a nondeleted copy with the same updatedAt in either merge order', () => {
    const removed = message('10', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    const original = message('10', { updatedAt: removed.updatedAt });
    expect(mergeMessages([removed], [original])).toEqual([removed]);
    expect(mergeMessages([original], [removed])).toEqual([removed]);
  });
});

describe('useRoomMessages lifecycle', () => {
  it('starts subscription before history resolves and merges buffered inserts/deletion updates', async () => {
    const h = harness();
    const history = deferred<Result<Page<Message>>>();
    h.getMessages.mockReturnValueOnce(history.promise);
    const { result } = h.mount();
    expect(h.subscribe).toHaveBeenCalledTimes(1);
    expect(h.getMessages).toHaveBeenCalledWith({ roomId: 'room-1', limit: 50 });
    const removed = message('10', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    act(() => {
      h.latest().onMessage(message('11'));
      h.latest().onMessage(message('11'));
      h.latest().onMessage(removed);
    });
    expect(result.current.messages).toEqual([]);
    await act(async () => { history.resolve(ok({ items: [message('10')], nextCursor: '10' })); });
    expect(result.current.messages).toEqual([removed, message('11')]);
    expect(result.current.hasOlder).toBe(true);
  });

  it('preserves applyLocal before the initial history response resolves', async () => {
    const h = harness();
    const history = deferred<Result<Page<Message>>>();
    h.getMessages.mockReturnValueOnce(history.promise);
    const { result } = h.mount();
    await act(async () => {});
    act(() => { result.current.applyLocal(message('11')); });
    expect(result.current.messages).toEqual([message('11')]);
    await act(async () => { history.resolve(ok({ items: [message('10')], nextCursor: null })); });
    expect(result.current.messages).toEqual([message('10'), message('11')]);
  });

  it('defers initial SUBSCRIBED reconciliation until history and its event buffer are merged', async () => {
    const h = harness();
    const history = deferred<Result<Page<Message>>>();
    h.getMessages.mockReturnValueOnce(history.promise);
    h.mount();
    act(() => { h.latest().onStatus('SUBSCRIBED'); h.latest().onMessage(message('11')); });
    expect(h.reconcile).not.toHaveBeenCalled();
    await act(async () => { history.resolve(ok({ items: [message('10')], nextCursor: null })); });
    expect(h.reconcile).toHaveBeenCalledTimes(1);
    expect(h.reconcile.mock.calls[0][0].currentMessages.map((m) => m.id)).toEqual(['10', '11']);
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'] as const)(
    'polls every 3 seconds after %s and stops polling when SUBSCRIBED returns', async (status) => {
      vi.useFakeTimers();
      const h = harness();
      const { result } = h.mount();
      await act(async () => {});
      act(() => { h.latest().onStatus(status); h.latest().onStatus(status); });
      expect(result.current.status).toBe('polling');
      await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
      expect(h.reconcile).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(h.reconcile).toHaveBeenCalledTimes(1);
      await act(async () => { h.latest().onStatus('SUBSCRIBED'); });
      expect(result.current.status).toBe('live');
      expect(h.reconcile).toHaveBeenCalledTimes(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
      expect(h.reconcile).toHaveBeenCalledTimes(2);
    },
  );

  it('passes the returned updatedAt/id cursor pair to subsequent recovery', async () => {
    vi.useFakeTimers();
    const h = harness();
    h.mount();
    await act(async () => {});
    await act(async () => { h.latest().onStatus('SUBSCRIBED'); });
    act(() => { h.latest().onStatus('CHANNEL_ERROR'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(h.reconcile.mock.calls[1][0]).toMatchObject({
      roomId: 'room-1', checkpoint: { updatedAt: '2026-11-11T00:00:01.000Z', id: '10' },
    });
  });

  it('deduplicates local delivery followed by the same realtime echo and applies deletion UPDATE', async () => {
    const h = harness();
    const { result } = h.mount();
    await act(async () => {});
    act(() => { result.current.applyLocal(message('11')); h.latest().onMessage(message('11')); });
    expect(result.current.messages.map((m) => m.id)).toEqual(['10', '11']);
    const removed = message('11', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    act(() => { h.latest().onMessage(removed); });
    expect(result.current.messages).toEqual([message('10'), removed]);
  });

  it('loads older history before the smallest ID and preserves a newer deletion state', async () => {
    const h = harness();
    h.getMessages.mockResolvedValueOnce(ok({ items: [message('10')], nextCursor: '10' }))
      .mockResolvedValueOnce(ok({ items: [message('2'), message('10')], nextCursor: null }));
    const { result } = h.mount();
    await act(async () => {});
    const removed = message('10', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    act(() => { h.latest().onMessage(removed); });
    await act(async () => { await result.current.loadOlder(); });
    expect(h.getMessages).toHaveBeenLastCalledWith({ roomId: 'room-1', beforeId: '10', limit: 50 });
    expect(result.current.messages).toEqual([message('2'), removed]);
    expect(result.current.hasOlder).toBe(false);
  });

  it('cleans up subscription and polling on unmount, ignoring CLOSED and late events', async () => {
    vi.useFakeTimers();
    const h = harness();
    const { unmount } = h.mount();
    await act(async () => {});
    act(() => { h.latest().onStatus('CHANNEL_ERROR'); });
    unmount();
    expect(h.latest().unsubscribe).toHaveBeenCalledTimes(1);
    act(() => { h.latest().onStatus('CLOSED'); h.latest().onMessage(message('99')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(h.reconcile).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops on session-reset, clearing messages and preventing late callbacks from restarting polling', async () => {
    vi.useFakeTimers();
    const h = harness();
    const { result } = h.mount();
    await act(async () => {});
    act(() => { h.latest().onStatus('CHANNEL_ERROR'); window.dispatchEvent(new Event('session-reset')); });
    expect(result.current.status).toBe('stopped');
    expect(result.current.messages).toEqual([]);
    expect(result.current.hasOlder).toBe(false);
    expect(h.latest().unsubscribe).toHaveBeenCalledTimes(1);
    act(() => { h.latest().onStatus('CLOSED'); h.latest().onMessage(message('99')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(h.reconcile).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('discards the previous room buffer and late history on a room change', async () => {
    const h = harness();
    const oldHistory = deferred<Result<Page<Message>>>();
    h.getMessages.mockReturnValueOnce(oldHistory.promise)
      .mockResolvedValueOnce(ok({ items: [message('20', { roomId: 'room-2' })], nextCursor: null }));
    const { result, rerender } = h.mount();
    const old = h.latest();
    act(() => { old.onMessage(message('99')); });
    rerender({ roomId: 'room-2' });
    await act(async () => { oldHistory.resolve(ok({ items: [message('10')], nextCursor: '10' })); });
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toEqual([message('20', { roomId: 'room-2' })]);
    expect(result.current.hasOlder).toBe(false);
  });

  it('discards an old reconciliation result after switching rooms and resets the cursor', async () => {
    const h = harness();
    const oldRecovery = deferred<Result<ReconcileRoomMessagesData>>();
    h.reconcile.mockReturnValueOnce(oldRecovery.promise);
    const { result, rerender } = h.mount();
    await act(async () => {});
    act(() => { h.latest().onStatus('SUBSCRIBED'); });
    h.getMessages.mockResolvedValueOnce(ok({ items: [message('20', { roomId: 'room-2' })], nextCursor: null }));
    rerender({ roomId: 'room-2' });
    await act(async () => {
      oldRecovery.resolve(ok({ messages: [message('99')], checkpoint: { updatedAt: '2026-11-11T01:00:00Z', id: '99' } }));
    });
    await act(async () => { h.latest().onStatus('SUBSCRIBED'); });
    expect(result.current.messages).toEqual([message('20', { roomId: 'room-2' })]);
    expect(h.reconcile.mock.calls[1][0].checkpoint).toBeNull();
  });

  it.each(['ROOM_INACTIVE', 'FORBIDDEN', 'UNAUTHENTICATED'])(
    'stops and unsubscribes when initial history returns %s', async (code) => {
      const h = harness();
      h.getMessages.mockResolvedValueOnce(failure(code));
      const { result } = h.mount();
      await act(async () => {});
      expect(result.current.status).toBe('stopped');
      expect(h.latest().unsubscribe).toHaveBeenCalledTimes(1);
      expect(result.current.messages).toEqual([]);
    },
  );

  it.each(['ROOM_INACTIVE', 'FORBIDDEN', 'UNAUTHENTICATED'])(
    'stops polling and unsubscribes when recovery returns %s', async (code) => {
      vi.useFakeTimers();
      const h = harness();
      h.reconcile.mockResolvedValueOnce(failure(code));
      const { result } = h.mount();
      await act(async () => {});
      act(() => { h.latest().onStatus('CHANNEL_ERROR'); });
      await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
      expect(h.reconcile).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('stopped');
      expect(h.latest().unsubscribe).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(['ROOM_INACTIVE', 'FORBIDDEN', 'UNAUTHENTICATED'])(
    'also stops all live resources when older history returns %s', async (code) => {
      vi.useFakeTimers();
      const h = harness();
      h.getMessages.mockResolvedValueOnce(ok({ items: [message('10')], nextCursor: '10' }))
        .mockResolvedValueOnce(failure(code));
      const { result } = h.mount();
      await act(async () => {});
      act(() => { h.latest().onStatus('CHANNEL_ERROR'); });
      await act(async () => { await result.current.loadOlder(); });
      expect(result.current.status).toBe('stopped');
      expect(h.latest().unsubscribe).toHaveBeenCalledTimes(1);
      expect(result.current.messages).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('does not lose an insert or resurrect a deletion received while reconciliation is in flight', async () => {
    const h = harness();
    const recovery = deferred<Result<ReconcileRoomMessagesData>>();
    h.reconcile.mockReturnValueOnce(recovery.promise);
    const { result } = h.mount();
    await act(async () => {});
    act(() => { h.latest().onStatus('SUBSCRIBED'); });
    const removed = message('10', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    act(() => { h.latest().onMessage(removed); h.latest().onMessage(message('11')); });
    await act(async () => {
      recovery.resolve(ok({ messages: [message('10')], checkpoint: { updatedAt: '2026-11-11T00:00:01.000Z', id: '10' } }));
    });
    expect(result.current.messages).toEqual([removed, message('11')]);
  });

  it.each(['SUBSCRIBED', 'CHANNEL_ERROR'] as const)(
    'recovers initial NETWORK_ERROR using %s rather than remaining stuck before initialization', async (status) => {
      vi.useFakeTimers();
      const h = harness();
      h.getMessages.mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK_ERROR', message: '', retryable: true } });
      h.reconcile.mockResolvedValue(ok({ messages: [message('10')], checkpoint: { updatedAt: message('10').updatedAt, id: '10' } }));
      const { result } = h.mount();
      await act(async () => {});
      await act(async () => { h.latest().onStatus(status); });
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(result.current.messages).toEqual([message('10')]);
      expect(h.reconcile).toHaveBeenCalled();
      expect(result.current.status).toBe(status === 'SUBSCRIBED' ? 'live' : 'polling');
    },
  );

  it('preserves applyLocal messages delivered while reconciliation is in flight', async () => {
    const h = harness();
    const recovery = deferred<Result<ReconcileRoomMessagesData>>();
    h.reconcile.mockReturnValueOnce(recovery.promise);
    const { result } = h.mount();
    await act(async () => {});
    act(() => { h.latest().onStatus('SUBSCRIBED'); result.current.applyLocal(message('11')); });
    await act(async () => {
      recovery.resolve(ok({ messages: [message('10')], checkpoint: { updatedAt: message('10').updatedAt, id: '10' } }));
    });
    expect(result.current.messages).toEqual([message('10'), message('11')]);
  });

  it('preserves older history loaded while reconciliation is in flight', async () => {
    const h = harness();
    const recovery = deferred<Result<ReconcileRoomMessagesData>>();
    h.reconcile.mockReturnValueOnce(recovery.promise);
    const { result } = h.mount();
    await act(async () => {});
    act(() => { h.latest().onStatus('SUBSCRIBED'); });
    h.getMessages.mockResolvedValueOnce(ok({ items: [message('2')], nextCursor: null }));
    await act(async () => { await result.current.loadOlder(); });
    await act(async () => {
      recovery.resolve(ok({ messages: [message('10')], checkpoint: { updatedAt: message('10').updatedAt, id: '10' } }));
    });
    expect(result.current.messages).toEqual([message('2'), message('10')]);
  });

  it('does not resurrect a newer recovery tombstone when overlapping older history arrives', async () => {
    const h = harness();
    const recovery = deferred<Result<ReconcileRoomMessagesData>>();
    h.reconcile.mockReturnValueOnce(recovery.promise);
    const { result } = h.mount();
    await act(async () => {});
    act(() => { h.latest().onStatus('SUBSCRIBED'); });
    h.getMessages.mockResolvedValueOnce(ok({ items: [message('2'), message('10')], nextCursor: null }));
    await act(async () => { await result.current.loadOlder(); });
    const removed = message('10', { body: null, deletedAt: '2026-11-11T00:00:02.000Z' });
    await act(async () => {
      recovery.resolve(ok({ messages: [removed], checkpoint: { updatedAt: removed.updatedAt, id: '10' } }));
    });
    expect(result.current.messages).toEqual([message('2'), removed]);
  });

  it('ignores a late applyLocal after session-reset has stopped and emptied the room', async () => {
    const h = harness();
    const { result } = h.mount();
    await act(async () => {});
    const lateApply = result.current.applyLocal;
    act(() => { window.dispatchEvent(new Event('session-reset')); });
    expect(result.current.status).toBe('stopped');
    act(() => { lateApply(message('11')); });
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe('stopped');
  });

  it('ignores the previous room applyLocal function retained by an in-flight submission', async () => {
    const h = harness();
    const { result, rerender } = h.mount();
    await act(async () => {});
    const oldApply = result.current.applyLocal;
    const currentRoomMessage = message('20', { roomId: 'room-2' });
    h.getMessages.mockResolvedValueOnce(ok({ items: [currentRoomMessage], nextCursor: null }));
    rerender({ roomId: 'room-2' });
    await act(async () => {});
    act(() => { oldApply(message('11', { roomId: 'room-1' })); });
    expect(result.current.messages).toEqual([currentRoomMessage]);
  });

  it('rejects a different-room message passed to the current applyLocal function', async () => {
    const h = harness();
    const { result, rerender } = h.mount();
    await act(async () => {});
    const currentRoomMessage = message('20', { roomId: 'room-2' });
    h.getMessages.mockResolvedValueOnce(ok({ items: [currentRoomMessage], nextCursor: null }));
    rerender({ roomId: 'room-2' });
    await act(async () => {});
    act(() => { result.current.applyLocal(message('11', { roomId: 'room-1' })); });
    expect(result.current.messages).toEqual([currentRoomMessage]);
  });

  it('keeps live status and no polling timer when history fails after SUBSCRIBED and recovery succeeds', async () => {
    vi.useFakeTimers();
    const h = harness();
    const history = deferred<Result<Page<Message>>>();
    h.getMessages.mockReturnValueOnce(history.promise);
    h.reconcile.mockResolvedValue(ok({ messages: [message('10')], checkpoint: { updatedAt: message('10').updatedAt, id: '10' } }));
    const { result } = h.mount();
    act(() => { h.latest().onStatus('SUBSCRIBED'); });
    await act(async () => {
      history.resolve({ ok: false, error: { code: 'NETWORK_ERROR', message: '', retryable: true } });
    });
    expect(result.current.messages).toEqual([message('10')]);
    expect(result.current.status).toBe('live');
    expect(h.reconcile).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(h.reconcile).toHaveBeenCalledTimes(1);
  });

  it('rejects an old userB applyLocal closure after reset, userA login, and room1→room2→room1 navigation', async () => {
    const api = createMockChatApi();
    api.setActor(accounts.userB);
    const submitted = await api.submitMessage({ requestId: crypto.randomUUID(), roomId: 'room-1', body: '이전 팬 B의 질문' });
    expect(submitted.ok && submitted.data.verdict).toBe('pass');
    if (!submitted.ok || submitted.data.verdict !== 'pass') throw new Error('Expected userB question');
    const oldQuestion = { ...submitted.data.message };
    const wrapper = ({ children }: { children: ReactNode }) => <ChatApiProvider api={api}>{children}</ChatApiProvider>;
    const { result, rerender } = renderHook(({ roomId }) => useRoomMessages(roomId), {
      wrapper, initialProps: { roomId: 'room-1' },
    });
    await act(async () => {});
    const oldApply = result.current.applyLocal;
    act(() => { window.dispatchEvent(new Event('session-reset')); });
    expect(result.current.messages).toEqual([]);
    api.setActor(accounts.userA);
    expect((await api.joinRoom({ requestId: crypto.randomUUID(), roomId: 'room-1' })).ok).toBe(true);
    rerender({ roomId: 'room-2' });
    await act(async () => {});
    rerender({ roomId: 'room-1' });
    await act(async () => {});
    const before = [...result.current.messages];
    expect(before.some((row) => row.id === oldQuestion.id)).toBe(false);
    act(() => { oldApply(oldQuestion); });
    expect(result.current.messages).toEqual(before);
    expect(result.current.messages.some((row) => row.id === oldQuestion.id)).toBe(false);
  });
});
