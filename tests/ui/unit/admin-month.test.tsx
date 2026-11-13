import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminPage from '@/app/admin/page';
import { createMockChatApi } from '@/components/chat/api/mock';
import { renderApp } from '../helpers/render-app';

// 관리자 데모 월(자성P v3 A-1): 현재 월은 서버 데모 시계에서만 읽고, 실패하면 추정하지 않고 오류·다시 시도를 보여 준다.
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin' }));
const network = { ok: false as const, error: { code: 'NETWORK_ERROR', message: '', retryable: true } };
const next = (month: string) => { const d = new Date(`${month}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };

describe('admin demo month', () => {
  it('shows the server demo month and advances to the following month', async () => {
    const api = createMockChatApi();
    const month = api.getMockDemoMonth();
    const advance = vi.spyOn(api, 'advanceDemoMonth');
    renderApp(<AdminPage />, api, 'admin');
    expect(await screen.findByText(`현재 월: ${month}`)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '한 달 경과' }));
    await waitFor(() => expect(advance).toHaveBeenCalledWith(expect.objectContaining({ targetMonth: next(month) })));
    expect(await screen.findByText(`현재 월: ${next(month)}`)).toBeVisible();
  });

  it('does not guess the month when it cannot be read, and recovers on retry', async () => {
    const api = createMockChatApi();
    const read = api.getAdminDemoMonth.bind(api);
    let fail = true;
    api.getAdminDemoMonth = async () => { if (fail) { fail = false; return network; } return read(); };
    renderApp(<AdminPage />, api, 'admin');
    expect(await screen.findByText(/현재 데모 월을 불러오지 못했어요/)).toBeVisible();
    expect(screen.queryByText(/현재 월:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '한 달 경과' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText(`현재 월: ${api.getMockDemoMonth()}`)).toBeVisible();
    expect(screen.getByRole('button', { name: '한 달 경과' })).toBeEnabled();
  });

  it('re-reads the server month when the transition is rejected', async () => {
    const api = createMockChatApi();
    const month = api.getMockDemoMonth();
    const read = vi.spyOn(api, 'getAdminDemoMonth');
    api.advanceDemoMonth = async () => ({ ok: false, error: { code: 'INVALID_MONTH_TRANSITION', message: '', retryable: false } });
    renderApp(<AdminPage />, api, 'admin');
    expect(await screen.findByText(`현재 월: ${month}`)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '한 달 경과' }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(screen.getByText(`현재 월: ${month}`)).toBeVisible();
  });
});
