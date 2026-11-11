import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/inbox/settings/page';
import { ChatApiProvider } from '@/components/chat/api/chat-api';
import { createMockChatApi } from '@/components/chat/api/mock';
import { accounts, useSession, type SessionUser } from '@/lib/session';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/session', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/session')>(), useSession: vi.fn(),
}));

const networkError = { ok: false as const, error: { code: 'NETWORK_ERROR', message: 'raw diagnostic', retryable: true } };
function mount(api: ReturnType<typeof createMockChatApi>, actor: SessionUser = accounts.influencer) {
  api.setActor(actor);
  vi.mocked(useSession).mockReturnValue({
    status: 'signedIn', user: actor, signIn: vi.fn(), signOut: vi.fn(), onSessionChange: vi.fn(),
  });
  return render(<ChatApiProvider api={api}><SettingsPage /></ChatApiProvider>);
}
async function readyCheckbox(name = '욕설') {
  const checkbox = await screen.findByRole('checkbox', { name });
  await waitFor(() => expect(checkbox).toBeEnabled());
  return checkbox;
}
async function visibleError() {
  return waitFor(() => {
    const errors = screen.getAllByRole('alert').filter((node) => node.textContent?.trim());
    expect(errors.length).toBeGreaterThan(0);
    return errors[0];
  });
}
async function turnOff(checkbox: HTMLElement) {
  await userEvent.click(checkbox);
  const dialog = await screen.findByRole('dialog', { name: '필터 해제' });
  expect(dialog).toHaveTextContent('끄면 욕설·비하성 메시지가 그대로 보일 수 있어요. 계속할까요?');
  await userEvent.click(within(dialog).getByRole('button', { name: '계속' }));
}

describe('settings filter failures and versioned mutations', () => {
  it('shows initial filter NETWORK_ERROR and allows a read retry to restore the controls', async () => {
    const api = createMockChatApi();
    const original = api.getRoomFilters.bind(api);
    const read = vi.spyOn(api, 'getRoomFilters').mockResolvedValueOnce(networkError).mockImplementation(original);
    mount(api);
    await visibleError();
    expect(screen.queryByText('raw diagnostic')).not.toBeInTheDocument();
    const retry = await screen.findByRole('button', { name: /다시 시도|재시도/ });
    await userEvent.click(retry);
    expect(await readyCheckbox()).toBeChecked();
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith({ roomId: 'room-1' });
  });

  it('does not disable successfully loaded filters when only the block-count Result fails', async () => {
    const api = createMockChatApi();
    vi.spyOn(api, 'getRoomDailyBlockCount').mockResolvedValue(networkError);
    mount(api);
    expect(await readyCheckbox('욕설')).toBeChecked();
    expect(await readyCheckbox('가벼운 비하')).toBeChecked();
    expect(await readyCheckbox('외모 평가')).toBeChecked();
  });

  it('retries a retryable filter mutation with identical requestId/input and uses the successful version next', async () => {
    const api = createMockChatApi();
    const original = api.updateRoomFilters.bind(api);
    const update = vi.spyOn(api, 'updateRoomFilters').mockResolvedValueOnce(networkError).mockImplementation(original);
    mount(api);
    const checkbox = await readyCheckbox();
    await turnOff(checkbox);
    await visibleError();
    expect(checkbox).toBeChecked();
    await userEvent.click(await screen.findByRole('button', { name: /다시 시도|재시도/ }));
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(update.mock.calls[1][0]).toEqual(update.mock.calls[0][0]);
    await turnOff(await readyCheckbox('가벼운 비하'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(3));
    expect(update.mock.calls[2][0].expectedVersion).toBe(2);
    expect(update.mock.calls[2][0].requestId).not.toBe(update.mock.calls[1][0].requestId);
  });

  it('does not claim fresh settings loaded when FILTERS_CHANGED recovery itself fails', async () => {
    const api = createMockChatApi();
    const original = api.getRoomFilters.bind(api);
    vi.spyOn(api, 'getRoomFilters').mockImplementationOnce(original).mockResolvedValue(networkError);
    vi.spyOn(api, 'updateRoomFilters').mockResolvedValue({
      ok: false, error: { code: 'FILTERS_CHANGED', message: '', retryable: true },
    });
    mount(api);
    const checkbox = await readyCheckbox();
    await turnOff(checkbox);
    await visibleError();
    expect(screen.queryByText(/최신값을 불러왔어요|저장했어요/)).not.toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(await screen.findByRole('button', { name: /다시 시도|재시도/ })).toBeEnabled();
  });

  it('cancels disabling a filter without sending a mutation', async () => {
    const api = createMockChatApi();
    const update = vi.spyOn(api, 'updateRoomFilters');
    mount(api);
    const checkbox = await readyCheckbox();
    await userEvent.click(checkbox);
    const dialog = await screen.findByRole('dialog', { name: '필터 해제' });
    expect(dialog).toHaveTextContent('끄면 욕설·비하성 메시지가 그대로 보일 수 있어요. 계속할까요?');
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(checkbox).toBeChecked();
    expect(update).not.toHaveBeenCalled();
    expect(dialog).not.toBeVisible();
  });

  it('displays mandatory filters in Korean as locked controls rather than raw category keys', async () => {
    const api = createMockChatApi(); mount(api);
    await readyCheckbox();
    // The contract fixes categories and Korean lock presentation, not literal copy.
    const categoryLabels = [/협박|위협/, /스토킹/, /성희롱/, /사생활|개인정보/, /혐오/, /불법 광고/, /스팸|도배/];
    const matchedRows = new Set<Element>();
    for (const label of categoryLabels) {
      const text = screen.getByText(label);
      const row = text.closest('li');
      expect(row).not.toBeNull();
      expect(row).toHaveTextContent(/항상 차단|잠금/);
      if (row) {
        matchedRows.add(row);
        for (const checkbox of within(row).queryAllByRole('checkbox')) expect(checkbox).toBeDisabled();
      }
    }
    expect(matchedRows.size).toBe(7);
    expect(screen.queryByText(/^sexual_harassment/)).not.toBeInTheDocument();
  });

  it('loads and updates the approved pending account own room rather than hardcoded room-1', async () => {
    const api = createMockChatApi();
    api.setActor(accounts.admin);
    expect((await api.approveVerification({
      requestId: crypto.randomUUID(), verificationId: 'verification-pending', decision: 'approved',
    })).ok).toBe(true);
    const read = vi.spyOn(api, 'getRoomFilters');
    const greeting = vi.spyOn(api, 'getRoomGreeting');
    const update = vi.spyOn(api, 'updateRoomFilters');
    mount(api, accounts.pendingInfluencer);
    await turnOff(await readyCheckbox());
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(read).toHaveBeenCalledWith({ roomId: 'room-11' });
    expect(greeting).toHaveBeenCalledWith({ roomId: 'room-11' });
    expect(update.mock.calls[0][0].roomId).toBe('room-11');
    expect(read.mock.calls.some(([input]) => input.roomId === 'room-1')).toBe(false);
  });

  it('normalizes disabledFilters by deduplicating and sorting the successful API result', async () => {
    const api = createMockChatApi(); api.setActor(accounts.influencer);
    const result = await api.updateRoomFilters({
      requestId: crypto.randomUUID(), roomId: 'room-1', expectedVersion: 1,
      disabledFilters: ['profanity', 'appearance', 'profanity'],
    });
    expect(result).toMatchObject({ ok: true, data: { disabledFilters: ['appearance', 'profanity'], version: 2 } });
    expect(await api.getRoomFilters({ roomId: 'room-1' })).toMatchObject({
      ok: true, data: { disabledFilters: ['appearance', 'profanity'], version: 2 },
    });
  });

  it.each(['change', 'retry'] as const)(
    'unlocks all three controls after successful FILTERS_CHANGED reload on the %s path and accepts the next toggle', async (path) => {
      const api = createMockChatApi();
      const original = api.updateRoomFilters.bind(api);
      const read = vi.spyOn(api, 'getRoomFilters');
      const update = vi.spyOn(api, 'updateRoomFilters').mockImplementation(original);
      if (path === 'retry') update.mockResolvedValueOnce(networkError);
      mount(api);
      const profanity = await readyCheckbox();
      // Another client updates the server while this page still holds version 1.
      expect(await original({
        requestId: crypto.randomUUID(), roomId: 'room-1', disabledFilters: ['appearance'], expectedVersion: 1,
      })).toMatchObject({ ok: true, data: { version: 2 } });
      await turnOff(profanity);
      if (path === 'retry') {
        await visibleError();
        await userEvent.click(await screen.findByRole('button', { name: /다시 시도|재시도/ }));
        expect(update.mock.calls[1][0]).toEqual(update.mock.calls[0][0]);
      }
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
      const controls = await Promise.all(['욕설', '가벼운 비하', '외모 평가'].map((name) => readyCheckbox(name)));
      expect(controls[0]).toBeChecked();
      expect(controls[1]).toBeChecked();
      expect(controls[2]).not.toBeChecked();
      expect(screen.queryByRole('button', { name: /다시 시도|재시도/ })).not.toBeInTheDocument();
      const callsBefore = update.mock.calls.length;
      await turnOff(controls[1]);
      await waitFor(() => expect(controls[1]).not.toBeChecked());
      expect(update).toHaveBeenCalledTimes(callsBefore + 1);
      const next = update.mock.calls[callsBefore][0];
      expect(next.expectedVersion).toBe(2);
      expect(next.requestId).not.toBe(update.mock.calls[callsBefore - 1][0].requestId);
      expect([...next.disabledFilters].sort()).toEqual(['appearance', 'belittling']);
    },
  );
});

describe('settings owned-room error boundaries', () => {
  it('shows the retryable network error and retries owned-room discovery without exposing settings early', async () => {
    const api = createMockChatApi();
    const original = api.getMyInfluencerProfile.bind(api);
    vi.spyOn(api, 'getMyInfluencerProfile').mockResolvedValueOnce(networkError).mockImplementation(original);
    mount(api);
    const error = await visibleError();
    expect(error).toHaveTextContent('연결이 불안정해요. 다시 시도해 주세요.');
    expect(screen.queryByRole('heading', { name: '인박스 설정' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /다시 시도|재시도/ }));
    expect(await readyCheckbox()).toBeChecked();
  });

  it('shows permission denial for FORBIDDEN without retry or settings content', async () => {
    const api = createMockChatApi();
    vi.spyOn(api, 'getMyInfluencerProfile').mockResolvedValue({
      ok: false, error: { code: 'FORBIDDEN', message: 'raw diagnostic', retryable: false },
    });
    mount(api);
    expect(await screen.findByText('이 화면을 사용할 권한이 없어요.', { exact: true })).toBeVisible();
    expect(screen.queryByRole('button', { name: /다시 시도|재시도/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '인박스 설정' })).not.toBeInTheDocument();
  });

  it('redirects to login for UNAUTHENTICATED during owned-room discovery', async () => {
    const api = createMockChatApi();
    vi.spyOn(api, 'getMyInfluencerProfile').mockResolvedValue({
      ok: false, error: { code: 'UNAUTHENTICATED', message: '', retryable: false },
    });
    mount(api);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByRole('heading', { name: '인박스 설정' })).not.toBeInTheDocument();
  });

  it('distinguishes an absent owned room from a network or permission error', async () => {
    const api = createMockChatApi();
    vi.spyOn(api, 'getRooms').mockResolvedValue({ ok: true, data: { items: [] } });
    mount(api);
    expect(await screen.findByText(/소유.*방.*없|설정.*방.*없/)).toBeVisible();
    expect(screen.queryByText('소유한 방을 불러오지 못했어요.', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '인박스 설정' })).not.toBeInTheDocument();
  });
});
