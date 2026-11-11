import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/inbox/settings/page';
import { ChatApiProvider } from '@/components/chat/api/chat-api';
import { createMockChatApi } from '@/components/chat/api/mock';
import { accounts, useSession } from '@/lib/session';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/session', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/session')>(), useSession: vi.fn(),
}));

function setup() {
  let next = 0;
  const create = vi.fn<(file: Blob) => string>().mockImplementation(() => `blob:test-${++next}`);
  const revoke = vi.fn<(url: string) => void>();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = create;
    static revokeObjectURL = revoke;
  });
  const api = createMockChatApi(); api.setActor(accounts.influencer);
  const profile = { influencerId: 'influencer-1', influencerName: '인플루언서 1', verifiedAt: '2026-01-01T00:00:00Z', profileImageUrl: '/old.webp', fallbackImageUrl: null };
  vi.spyOn(api, 'getMyInfluencerProfile').mockResolvedValue({ ok: true, data: profile });
  vi.mocked(useSession).mockReturnValue({
    status: 'signedIn', user: accounts.influencer, signIn: vi.fn(), signOut: vi.fn(), onSessionChange: vi.fn(),
  });
  const view = render(<ChatApiProvider api={api}><SettingsPage /></ChatApiProvider>);
  return { api, profile, create, revoke, ...view };
}
const validation = 'JPG·PNG·WebP 형식의 5MB 이하 사진만 올릴 수 있어요';
const file = (type: string, size = 10) => new File([new Uint8Array(size)], 'photo', { type });

describe('photo input validation, preview lifecycle and retry', () => {
  it.each([
    ['image/gif', 10], ['image/svg+xml', 10], ['image/png', 5_242_881], ['image/png', 6_291_456],
  ])('rejects %s / %d bytes before upload and keeps the previous photo', async (type, size) => {
    const h = setup();
    const upload = vi.spyOn(h.api, 'uploadInfluencerProfilePhoto');
    const input = await screen.findByLabelText('사진 선택');
    fireEvent.change(input, { target: { files: [file(String(type), Number(size))] } });
    expect(screen.getByText(validation, { exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: '사진 저장' })).toBeDisabled();
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: '프로필 사진 미리보기' })).toHaveAttribute('src', '/old.webp');
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s at exactly 5 MiB without uploading automatically', async (type) => {
    const h = setup();
    const upload = vi.spyOn(h.api, 'uploadInfluencerProfilePhoto');
    const input = await screen.findByLabelText('사진 선택');
    const selected = file(type, 5_242_880);
    fireEvent.change(input, { target: { files: [selected] } });
    expect(screen.queryByText(validation, { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 저장' })).toBeEnabled();
    expect(h.create).toHaveBeenCalledWith(selected);
    expect(upload).not.toHaveBeenCalled();
  });

  it('revokes each preview URL on replacement and unmount', async () => {
    const h = setup();
    const input = await screen.findByLabelText('사진 선택');
    fireEvent.change(input, { target: { files: [file('image/png')] } });
    expect(screen.getByRole('img', { name: '프로필 사진 미리보기' })).toHaveAttribute('src', 'blob:test-1');
    fireEvent.change(input, { target: { files: [file('image/webp')] } });
    expect(h.revoke).toHaveBeenCalledWith('blob:test-1');
    expect(screen.getByRole('img', { name: '프로필 사진 미리보기' })).toHaveAttribute('src', 'blob:test-2');
    h.unmount();
    expect(h.revoke).toHaveBeenCalledWith('blob:test-2');
    expect(h.revoke).toHaveBeenCalledTimes(2);
  });

  it('retries the same File and requestId and refreshes rooms after retry succeeds', async () => {
    const h = setup();
    const rooms = vi.spyOn(h.api, 'getRooms');
    const upload = vi.spyOn(h.api, 'uploadInfluencerProfilePhoto')
      .mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK_ERROR', message: '', retryable: true } })
      .mockResolvedValueOnce({ ok: true, data: { ...h.profile, profileImageUrl: '/new.webp' } });
    const input = await screen.findByLabelText('사진 선택');
    const selected = file('image/png');
    fireEvent.change(input, { target: { files: [selected] } });
    await userEvent.click(screen.getByRole('button', { name: '사진 저장' }));
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '사진 저장' })).toBeDisabled());
    expect(upload.mock.calls[1][0]).toEqual(upload.mock.calls[0][0]);
    expect(upload.mock.calls[1][0].file).toBe(selected);
    expect(screen.getByRole('img', { name: '프로필 사진 미리보기' })).toHaveAttribute('src', '/new.webp');
    // Includes the initial owned-room discovery and the post-success refresh.
    expect(rooms).toHaveBeenCalledTimes(2);
  });
});
