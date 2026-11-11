import { useEffect, type ReactNode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider, useSession, type SessionState } from '@/lib/session';

function wrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

describe('mock session', () => {
  it.each([
    ['userA', 'user'], ['userB', 'user'], ['influencer', 'influencer'],
    ['pendingInfluencer', 'influencer'], ['admin', 'admin'],
  ])('signs in %s with the expected role %s', async (key, role) => {
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.status).toBe('signedOut');
    await act(async () => {
      expect(await result.current.signIn(key, '')).toMatchObject({
        ok: true, data: { userId: key, role },
      });
    });
    expect(result.current).toMatchObject({ status: 'signedIn', user: { userId: key, role } });
  });

  it('rejects an unknown account and preserves the current session', async () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    await act(async () => { await result.current.signIn('userA', ''); });
    await act(async () => {
      expect(await result.current.signIn('unknown', '')).toMatchObject({
        ok: false, error: { code: 'VALIDATION_ERROR', retryable: false },
      });
    });
    expect(result.current).toMatchObject({ status: 'signedIn', user: { userId: 'userA' } });
  });

  it('emits reset on sign-out and account change, leaving no previous user in session state', async () => {
    const reset = vi.fn();
    window.addEventListener('session-reset', reset);
    try {
      const { result } = renderHook(() => useSession(), { wrapper });
      await act(async () => { await result.current.signIn('userA', ''); });
      reset.mockClear();
      await act(async () => { await result.current.signOut(); });
      expect(result.current.status).toBe('signedOut');
      expect('user' in result.current).toBe(false);
      expect(reset).toHaveBeenCalledTimes(1);
      await act(async () => { await result.current.signIn('userB', ''); });
      expect(result.current).toMatchObject({ status: 'signedIn', user: { userId: 'userB' } });
      expect(reset).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener('session-reset', reset);
    }
  });

  it('notifies session subscribers and stops notifying after unsubscribe', async () => {
    const observer = vi.fn<(state: SessionState) => void>();
    const { result } = renderHook(() => useSession(), { wrapper });
    const unsubscribe = result.current.onSessionChange(observer);
    try {
      await act(async () => { await result.current.signIn('influencer', ''); });
      expect(observer).toHaveBeenLastCalledWith(expect.objectContaining({
        status: 'signedIn', user: expect.objectContaining({ userId: 'influencer' }),
      }));
      await act(async () => { await result.current.signOut(); });
      expect(observer).toHaveBeenLastCalledWith({ status: 'signedOut' });
      unsubscribe();
      observer.mockClear();
      await act(async () => { await result.current.signIn('admin', ''); });
      expect(observer).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('allows a consumer to clean up its subscription on unmount while the provider stays active', async () => {
    const observer = vi.fn<(state: SessionState) => void>();
    function Subscriber() {
      const { onSessionChange } = useSession();
      useEffect(() => onSessionChange(observer), [onSessionChange]);
      return null;
    }
    function Controls() {
      const session = useSession();
      return <>
        <p>{session.status === 'signedIn' ? session.user.nickname : session.status}</p>
        <button onClick={() => { void session.signIn('admin', ''); }}>관리자 로그인</button>
      </>;
    }
    const user = userEvent.setup();
    const { rerender } = render(<SessionProvider><Controls /><Subscriber /></SessionProvider>);
    rerender(<SessionProvider><Controls /></SessionProvider>);
    observer.mockClear();
    await user.click(screen.getByRole('button', { name: '관리자 로그인' }));
    expect(screen.getByText('관리자')).toBeInTheDocument();
    expect(observer).not.toHaveBeenCalled();
  });

  it('restores the signed-in account after the provider remounts', async () => {
    const first = renderHook(() => useSession(), { wrapper });
    await act(async () => { await first.result.current.signIn('userB', ''); });
    first.unmount();
    const restored = renderHook(() => useSession(), { wrapper });
    expect(restored.result.current).toMatchObject({
      status: 'signedIn', user: { userId: 'userB', role: 'user' },
    });
  });

  it('does not restore the previous account after sign-out and remount', async () => {
    const first = renderHook(() => useSession(), { wrapper });
    await act(async () => { await first.result.current.signIn('influencer', ''); });
    await act(async () => { await first.result.current.signOut(); });
    first.unmount();
    const restored = renderHook(() => useSession(), { wrapper });
    expect(restored.result.current.status).toBe('signedOut');
    expect('user' in restored.result.current).toBe(false);
  });

  it('ignores a stored unknown account instead of trusting stored role data', () => {
    sessionStorage.setItem('birdiebuddy-mock-account', '{"userId":"forged","role":"admin"}');
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.status).toBe('signedOut');
  });

  it('allows login and logout when session storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('unavailable'); });
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.status).toBe('signedOut');
    await act(async () => { await result.current.signIn('userA', ''); });
    expect(result.current).toMatchObject({ status: 'signedIn', user: { userId: 'userA' } });
    await act(async () => { await result.current.signOut(); });
    expect(result.current.status).toBe('signedOut');
  });
});
