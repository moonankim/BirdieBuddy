import type { Message } from '@/lib/api/types';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

export function message(id: string, changes: Partial<Message> = {}): Message {
  return {
    id, roomId: 'room-1', senderId: 'influencer', senderType: 'influencer',
    messageKind: 'influencer_broadcast', recipientUserId: null, senderName: '인플루언서',
    body: `본문 ${id}`, replyTo: null, replyContext: null, deletedAt: null,
    passesAllFilters: true, isReplyToMe: false, createdAt: '2026-11-11T00:00:00.000Z',
    updatedAt: changes.deletedAt ?? '2026-11-11T00:00:00.000Z', clusterId: null,
    supportBadge: null, ownScore: null, qualityScore: null, priority: null,
    ...changes,
  };
}
