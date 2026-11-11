'use client';
import {createContext,useContext,useState,type ReactNode} from 'react';
import {useSession} from '@/lib/session';
import {ChatApiProvider} from './api/chat-api';
import {createMockChatApi} from './api/mock';
const DemoClock=createContext<(()=>string)|null>(null);
export function useMockDemoMonth(){const read=useContext(DemoClock);if(!read)throw new Error('Mock demo clock missing');return read;}
export function Providers({children}:{children:ReactNode}){const session=useSession();const [api]=useState(()=>createMockChatApi());api.setActor(session.status==='signedIn'?session.user:null);return <ChatApiProvider api={api}><DemoClock.Provider value={api.getMockDemoMonth}>{children}</DemoClock.Provider></ChatApiProvider>;}
