import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/inbox/settings/page';
import VerificationPage from '@/app/inbox/verification/page';
import { createMockChatApi } from '@/components/chat/api/mock';
import { accounts } from '@/lib/session';
import { renderApp } from '../helpers/render-app';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const network = { ok: false as const, error: { code: 'NETWORK_ERROR', message: '', retryable: true } };

describe('settings read failures and greeting mutation recovery', () => {
  it('retries greeting discovery and fills the editor with the actual saved greeting', async () => {
    const api = createMockChatApi(); api.setActor(accounts.influencer);
    expect((await api.updateRoomGreeting({ requestId: crypto.randomUUID(), roomId: 'room-1', expectedVersion: 1, text: '저장된 인사말' })).ok).toBe(true);
    const original = api.getRoomGreeting.bind(api);
    const read = vi.spyOn(api, 'getRoomGreeting').mockResolvedValueOnce(network).mockImplementation(original);
    renderApp(<SettingsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('textbox', { name: '인사말' })).toHaveValue('저장된 인사말');
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('사진 선택')).toBeVisible();
  });

  it('retries the settings profile read independently without hiding a successful greeting', async () => {
    const api = createMockChatApi();
    const original = api.getMyInfluencerProfile.bind(api);
    const read = vi.spyOn(api, 'getMyInfluencerProfile').mockImplementationOnce(original).mockImplementationOnce(original)
      .mockResolvedValueOnce(network).mockResolvedValueOnce({ ok: true, data: {
        influencerId: 'influencer-1', influencerName: '인플루언서 1', verifiedAt: '2026-01-01T00:00:00Z', profileImageUrl: '/server.webp', fallbackImageUrl: null,
      } });
    renderApp(<SettingsPage />, api);
    await screen.findByRole('textbox', { name: '인사말' });
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('img', { name: '프로필 사진 미리보기' })).toHaveAttribute('src', '/server.webp');
    expect(read).toHaveBeenCalledTimes(4); // Guard 인증 확인 + OwnedRoom + settings read + settings retry.
  });

  it('retries a failed greeting save with the same ID/input and uses the returned version on the next save', async () => {
    const api = createMockChatApi();
    const original = api.updateRoomGreeting.bind(api);
    const save = vi.spyOn(api, 'updateRoomGreeting').mockResolvedValueOnce(network).mockImplementation(original);
    renderApp(<SettingsPage />, api);
    const input = await screen.findByRole('textbox', { name: '인사말' });
    await userEvent.type(input, '새 인사말');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(input).toHaveValue('새 인사말');
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    await screen.findByText('저장했어요.');
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
    await userEvent.clear(input); await userEvent.type(input, '다음 인사말');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save.mock.calls[2][0].expectedVersion).toBe(2);
    expect(save.mock.calls[2][0].requestId).not.toBe(save.mock.calls[1][0].requestId);
  });

  it('reloads version conflicts while preserving the draft and sends the next save against the fresh version', async () => {
    const api = createMockChatApi();
    const original = api.updateRoomGreeting.bind(api);
    const save = vi.spyOn(api, 'updateRoomGreeting');
    const read = vi.spyOn(api, 'getRoomGreeting');
    renderApp(<SettingsPage />, api);
    const input = await screen.findByRole('textbox', { name: '인사말' });
    await userEvent.type(input, '보존할 초안');
    expect((await original({ requestId: crypto.randomUUID(), roomId: 'room-1', expectedVersion: 1, text: '다른 창의 인사말' })).ok).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(input).toHaveValue('보존할 초안');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0]).toMatchObject({ expectedVersion: 2, text: '보존할 초안' });
    expect(save.mock.calls[1][0].requestId).not.toBe(save.mock.calls[0][0].requestId);
  });
});

describe('verification discovery and concurrent pending application', () => {
  it('shows a failed application-list read and reloads it on retry', async () => {
    const api = createMockChatApi();
    const original = api.getMyVerifications.bind(api);
    const read = vi.spyOn(api, 'getMyVerifications').mockResolvedValueOnce(network).mockImplementation(original);
    renderApp(<VerificationPage />, api, 'pendingInfluencer');
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText(/유튜버.*심사 대기/)).toBeVisible();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('refreshes applications after PENDING_EXISTS and displays the server pending record', async () => {
    const api = createMockChatApi();
    const original = api.getMyVerifications.bind(api);
    const read = vi.spyOn(api, 'getMyVerifications').mockResolvedValueOnce({ ok: true, data: { items: [], nextCursor: null } }).mockImplementation(original);
    renderApp(<VerificationPage />, api, 'pendingInfluencer');
    await screen.findByText('신청 내역이 없어요.');
    await userEvent.type(screen.getByRole('textbox', { name: '증빙 URL' }), 'https://example.com/evidence');
    await userEvent.click(screen.getByRole('button', { name: '신청' }));
    expect(await screen.findByText(/유튜버.*심사 대기/)).toBeVisible();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
