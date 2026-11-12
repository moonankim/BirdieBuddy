'use client';
import {createContext,useContext,useState,type ReactNode} from 'react';
import {dataMode,useSession} from '@/lib/session';
import {getBrowserClient} from '@/lib/session/client';
import {createBackendApi} from '@/lib/api';
import {ChatApiProvider,type ChatApi} from './api/chat-api';
import {createMockChatApi} from './api/mock';

// 관리자 "한 달 경과"의 시작 월. 목 모드는 목 SDK의 데모 시계, 실제 모드는 서버 시계를 읽는 SDK가 없어
// KST 이번 달 1일을 기본값으로 쓰고, 서버가 INVALID_MONTH_TRANSITION(details.currentMonth)을 주면 그 값으로 맞춘다.
const DemoClock=createContext<(()=>string)|null>(null);
export function useDemoMonth(){const read=useContext(DemoClock);if(!read)throw new Error('Demo clock missing');return read;}
const kstMonthStart=()=>`${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date())}-01`;

function MockProviders({children}:{children:ReactNode}){
  const session=useSession();
  const [api]=useState(()=>createMockChatApi());
  api.setActor(session.status==='signedIn'?session.user:null);
  return <ChatApiProvider api={api}><DemoClock.Provider value={api.getMockDemoMonth}>{children}</DemoClock.Provider></ChatApiProvider>;
}
function SupabaseProviders({children}:{children:ReactNode}){
  // 실제 SDK(홍주P lib/api). 인증은 supabase-js 세션을 그대로 쓰므로 actor 주입이 없다.
  const [api]=useState<ChatApi>(()=>createBackendApi(getBrowserClient()));
  return <ChatApiProvider api={api}><DemoClock.Provider value={kstMonthStart}>{children}</DemoClock.Provider></ChatApiProvider>;
}
export function Providers({children}:{children:ReactNode}){return dataMode==='supabase'?<SupabaseProviders>{children}</SupabaseProviders>:<MockProviders>{children}</MockProviders>;}
