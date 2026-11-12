import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  profile: null as null | { id: string; nickname: string; role: string },
  signInResult: { data: { user: { id: 'uuid-a' } }, error: null } as { data: { user: { id: string } | null }; error: null | { status: number; message: string } },
  signOut: vi.fn(async () => ({ error: null })),
}));
vi.mock('@/lib/session/mode', () => ({ dataMode: 'supabase' }));
vi.mock('@/lib/session/client', () => ({
  getBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => auth.signInResult,
      signOut: auth.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: auth.profile, error: null }) }) }) }),
  }),
}));

import { SessionProvider, useSession } from '@/lib/session';
const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;

describe('Supabase session mode', () => {
  beforeEach(() => {
    auth.session = null;
    auth.profile = { id: 'uuid-a', nickname: '사용자 A', role: 'user' };
    auth.signInResult = { data: { user: { id: 'uuid-a' } }, error: null };
    auth.signOut.mockClear();
  });

  it('signs in with email/password and reads role/nickname from profiles', async () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    let outcome;
    await act(async () => { outcome = await result.current.signIn('user-a@example.test', 'pw'); });
    expect(outcome).toMatchObject({ ok: true, data: { userId: 'uuid-a', role: 'user', nickname: '사용자 A' } });
    expect(result.current).toMatchObject({ status: 'signedIn', user: { userId: 'uuid-a' } });
  });

  it('restores an existing Auth session on load', async () => {
    auth.session = { user: { id: 'uuid-a' } };
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current).toMatchObject({ status: 'signedIn', user: { nickname: '사용자 A' } }));
  });

  it('reports wrong credentials as UNAUTHENTICATED and stays signed out', async () => {
    auth.signInResult = { data: { user: null }, error: { status: 400, message: 'Invalid login credentials' } };
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    let outcome;
    await act(async () => { outcome = await result.current.signIn('user-a@example.test', 'wrong'); });
    expect(outcome).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    expect(result.current.status).toBe('signedOut');
  });

  it('signs back out when the account has no profile row', async () => {
    auth.profile = null;
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    let outcome;
    await act(async () => { outcome = await result.current.signIn('ghost@example.test', 'pw'); });
    expect(outcome).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(auth.signOut).toHaveBeenCalled();
    expect(result.current.status).toBe('signedOut');
  });
});
