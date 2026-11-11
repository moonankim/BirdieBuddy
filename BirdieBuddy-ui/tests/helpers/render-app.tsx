import { useEffect, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { SessionProvider, useSession } from '@/lib/session';
import { ChatApiProvider } from '@/components/chat/api/chat-api';
import type { MockChatApi } from '@/components/chat/api/mock';

function SignedInApi({ api, account, children }: { api: MockChatApi; account: string; children: ReactNode }) {
  const session = useSession();
  const { signIn } = session;
  useEffect(() => { if (session.status === 'signedOut') void signIn(account, ''); }, [session.status, signIn, account]);
  api.setActor(session.status === 'signedIn' ? session.user : null);
  return <ChatApiProvider api={api}>{session.status === 'signedIn' ? children : <p>테스트 세션 준비</p>}</ChatApiProvider>;
}

export function renderApp(ui: ReactNode, api: MockChatApi, account = 'influencer') {
  return render(<SessionProvider><SignedInApi api={api} account={account}>{ui}</SignedInApi></SessionProvider>);
}
