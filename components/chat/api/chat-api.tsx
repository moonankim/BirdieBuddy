'use client';
import {createContext,useContext,useEffect,useMemo,useRef,type ReactNode} from 'react';
import type {BackendApi} from '@/lib/api/types';
// 화면이 쓰는 SDK 함수만 고른다. 타입 원본은 루트 lib/api(홍주P 계약)이며 화면 패키지에 복제하지 않는다.
export type ChatApi = Pick<BackendApi,
  'getMyVerifications'
  | 'getPendingVerifications'
  | 'requestVerification'
  | 'approveVerification'
  | 'getRoomInbox'
  | 'getRoomDailyBlockCount'
  | 'replyToMessage'
  | 'sendBroadcast'
  | 'deleteInfluencerMessage'
  | 'advanceDemoMonth'
  | 'getRoomFilters'
  | 'updateRoomFilters'
  | 'getRoomGreeting'
  | 'updateRoomGreeting'
  | 'getMyInfluencerProfile'
  | 'uploadInfluencerProfilePhoto'
  | 'clusterQuestions'
  | 'summarizeRoom'
  | 'getRooms'
  | 'getMyMembership'
  | 'joinRoom'
  | 'getMyRoundGaugeSummary'
  | 'getAdminDemoMonth'
  | 'getRoomReadState'
  | 'markRoomRead'
  | 'getInboxReadState'
  | 'markInboxChecked'
  | 'getMessages'
  | 'subscribeRoomMessages'
  | 'reconcileRoomMessages'
  | 'submitMessage'
  | 'getCollection'
  | 'getOwnedCards'
  | 'completeRound'
>;
const Context=createContext<ChatApi|null>(null);
export function ChatApiProvider({api,children}:{api:ChatApi;children:ReactNode}){const epoch=useRef(0);useEffect(()=>{const reset=()=>{epoch.current++;};window.addEventListener('session-reset',reset);return()=>window.removeEventListener('session-reset',reset);},[]);const wrapped=useMemo(()=>new Proxy(api,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return (...args:unknown[])=>{const current=epoch.current;const result=Reflect.apply(value,target,args);if(result instanceof Promise)return result.then((response:unknown)=>{if(current===epoch.current&&response&&typeof response==='object'&&'ok' in response&&response.ok===false&&'error' in response){const error=response.error as {code?:string};if(error?.code==='UNAUTHENTICATED')window.dispatchEvent(new Event('auth-required'));}return response;});return result;};}}),[api]);return <Context.Provider value={wrapped}>{children}</Context.Provider>;}

export function useChatApi(){const api=useContext(Context);if(!api)throw new Error('ChatApiProvider missing');return api;}
