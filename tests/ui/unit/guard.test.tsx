import type { ReactNode } from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Guard } from '@/components/chat/shell';
import { useSession, type SessionState, type SessionUser } from '@/lib/session';
import { ChatApiProvider } from '@/components/chat/api/chat-api';
import { createMockChatApi } from '@/components/chat/api/mock';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/session', () => ({ useSession: vi.fn() }));

const content = '보호된 화면 내용';
let api: ReturnType<typeof createMockChatApi>;
function render(ui: ReactNode) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <ChatApiProvider api={api}>{children}</ChatApiProvider>,
  });
}
function setSession(state: SessionState) {
  api.setActor(state.status === 'signedIn' ? state.user : null);
  vi.mocked(useSession).mockReturnValue({
    ...state,
    signIn: vi.fn(), signOut: vi.fn(), onSessionChange: vi.fn(),
  });
}
function signIn(role: SessionUser['role'], userId: string = role) {
  setSession({ status: 'signedIn', user: { userId, role, nickname: userId } });
}

beforeEach(() => {
  api = createMockChatApi();
  setSession({ status: 'signedOut' });
});

describe('Guard role and authentication boundaries', () => {
  it.each(['user', 'influencer', 'admin'] as const)(
    'redirects signed-out visitors from the %s route without rendering its content', (role) => {
      render(<Guard role={role}>{content}</Guard>);
      expect(navigation.replace).toHaveBeenCalledWith('/login');
      expect(screen.queryByText(content)).not.toBeInTheDocument();
    },
  );

  it('hides protected content during loading without redirecting before session resolution', () => {
    setSession({ status: 'loading' });
    const { rerender } = render(<Guard role="user">{content}</Guard>);
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
    signIn('user', 'userA');
    rerender(<Guard role="user">{content}</Guard>);
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it.each(['influencer', 'admin'] as const)(
    'shows the fan-only explanation to %s accounts on a user route', (role) => {
      signIn(role);
      render(<Guard role="user">{content}</Guard>);
      expect(screen.getByText('이 화면은 팬 계정에서 볼 수 있어요.')).toBeInTheDocument();
      expect(screen.queryByText(content)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '인증 신청' })).not.toBeInTheDocument();
    },
  );

  it.each([
    ['user', 'influencer'], ['user', 'admin'], ['admin', 'influencer'], ['influencer', 'admin'],
  ] as const)('denies %s accounts access to %s content without an application link', (actor, routeRole) => {
    signIn(actor);
    render(<Guard role={routeRole} verified>{content}</Guard>);
    expect(screen.getByText('이 화면을 사용할 권한이 없어요.')).toBeInTheDocument();
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '인증 신청' })).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('offers verification only to an unverified influencer denied by a verified route', async () => {
    signIn('influencer', 'pendingInfluencer');
    render(<Guard role="influencer" verified>{content}</Guard>);
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '인증 신청' })).toHaveAttribute('href', '/inbox/verification');
  });

  it('allows an unverified influencer onto a route that does not require verification', () => {
    signIn('influencer', 'pendingInfluencer');
    render(<Guard role="influencer">{content}</Guard>);
    expect(screen.getByText(content)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '인증 신청' })).not.toBeInTheDocument();
  });

  it('allows a verified influencer onto a verified route', async () => {
    signIn('influencer');
    render(<Guard role="influencer" verified>{content}</Guard>);
    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '인증 신청' })).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('allows the same pending influencer into inbox after the administrator approves the application', async () => {
    signIn('influencer', 'pendingInfluencer');
    const before = render(<Guard role="influencer" verified>{content}</Guard>);
    expect(await screen.findByRole('link', { name: '인증 신청' })).toBeInTheDocument();
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    before.unmount();

    api.setActor({ userId: 'admin', role: 'admin', nickname: '관리자' });
    expect(await api.approveVerification({
      requestId: crypto.randomUUID(), verificationId: 'verification-pending', decision: 'approved',
    })).toMatchObject({ ok: true, data: { verification: { status: 'approved' } } });
    signIn('influencer', 'pendingInfluencer');
    render(<Guard role="influencer" verified>{content}</Guard>);
    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '인증 신청' })).not.toBeInTheDocument();
  });
});

describe('Guard verification source', () => {
  it('allows a seeded influencer whose profile is verified even without an approved application row', async () => {
    signIn('influencer');
    api.getMyVerifications = async () => ({ ok: true, data: { items: [], nextCursor: null } });
    render(<Guard role="influencer" verified>{content}</Guard>);
    expect(await screen.findByText(content)).toBeInTheDocument();
  });

  it('shows an error only when neither the profile nor the applications can be read', async () => {
    signIn('influencer');
    const network = { ok: false as const, error: { code: 'NETWORK_ERROR', message: '', retryable: true } };
    api.getMyVerifications = async () => network;
    api.getMyInfluencerProfile = async () => network;
    render(<Guard role="influencer" verified>{content}</Guard>);
    expect(await screen.findByText('인증 상태를 확인하지 못했어요.')).toBeInTheDocument();
  });
});
