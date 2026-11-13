'use client';
import {useState,type ReactNode} from 'react';
import {dataMode,useSession} from '@/lib/session';
import {getBrowserClient} from '@/lib/session/client';
import {createBackendApi} from '@/lib/api';
import {ChatApiProvider,type ChatApi} from './api/chat-api';
import {createMockChatApi} from './api/mock';

function MockProviders({children}:{children:ReactNode}){
  const session=useSession();
  const [api]=useState(()=>createMockChatApi());
  api.setActor(session.status==='signedIn'?session.user:null);
  return <ChatApiProvider api={api}>{children}</ChatApiProvider>;
}
function SupabaseProviders({children}:{children:ReactNode}){
  // 실제 SDK(홍주P lib/api). 인증은 supabase-js 세션을 그대로 쓰므로 actor 주입이 없다.
  const [api]=useState<ChatApi>(()=>createBackendApi(getBrowserClient()));
  return <ChatApiProvider api={api}>{children}</ChatApiProvider>;
}
export function Providers({children}:{children:ReactNode}){return dataMode==='supabase'?<SupabaseProviders>{children}</SupabaseProviders>:<MockProviders>{children}</MockProviders>;}
