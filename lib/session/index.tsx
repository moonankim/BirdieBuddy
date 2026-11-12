'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Result } from '@/lib/api/types';
import { dataMode } from './mode';
import { getBrowserClient } from './client';
export type SessionUser = { userId: string; role: 'user' | 'influencer' | 'admin'; nickname: string };
export type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: SessionUser };
export const accounts: Record<string, SessionUser> = { userA:{userId:'userA',role:'user',nickname:'팬 A'}, userB:{userId:'userB',role:'user',nickname:'팬 B'}, influencer:{userId:'influencer',role:'influencer',nickname:'인플루언서'}, pendingInfluencer:{userId:'pendingInfluencer',role:'influencer',nickname:'신청자'}, admin:{userId:'admin',role:'admin',nickname:'관리자'} };
// 실제 모드에서 userId는 Supabase Auth user.id, 역할·닉네임은 profiles(본인 행만 SELECT 가능)에서 읽는다.
// 역할은 화면 분기용 표시 정보일 뿐이며 권한은 서버 RLS/RPC가 다시 판단한다(홍주P §13.9).
// 팬 첫 화면은 현호P와 홈 경로(/home·/draw) 합의 전까지 /chat이다.
export function homeFor(user:SessionUser):string { return user.role==='user'?'/chat':user.role==='admin'?'/admin':'/inbox'; }
type Context = SessionState & { signIn:(email:string,password:string)=>Promise<Result<SessionUser>>; signOut:()=>Promise<void>; onSessionChange:(cb:(state:SessionState)=>void)=>()=>void };
const C = createContext<Context | null>(null);
function MockSessionProvider({children}:{children:ReactNode}) {
 const [state,setState]=useState<SessionState>({status:'loading'}); const listeners=useRef(new Set<(state:SessionState)=>void>());
 useEffect(()=>{let user:SessionUser|undefined; try {const key=sessionStorage.getItem('birdiebuddy-mock-account'); if(key) user=accounts[key];} catch {} setState(user?{status:'signedIn',user}:{status:'signedOut'});},[]);
 const signIn=useCallback(async (key:string,_password:string):Promise<Result<SessionUser>>=>{ const user=accounts[key]; if(!user) return {ok:false,error:{code:'VALIDATION_ERROR',message:'',retryable:false}}; window.dispatchEvent(new Event('session-reset')); try {sessionStorage.setItem('birdiebuddy-mock-account',key);} catch {} setState({status:'signedIn',user}); return {ok:true,data:user}; },[]);
 const signOut=useCallback(async()=>{window.dispatchEvent(new Event('session-reset'));try {sessionStorage.removeItem('birdiebuddy-mock-account');} catch {} setState({status:'signedOut'});},[]);
 const onSessionChange=useCallback((cb:(s:SessionState)=>void)=>{listeners.current.add(cb);return ()=>{listeners.current.delete(cb);};},[]);
 useEffect(()=>{listeners.current.forEach(cb=>cb(state));},[state]);
 const value=useMemo(()=>({...state,signIn,signOut,onSessionChange}) as Context,[state,signIn,signOut,onSessionChange]);
 return <C.Provider value={value}>{children}</C.Provider>;
}
const failure=(code:string,message=''):Result<SessionUser>=>({ok:false,error:{code,message,retryable:code==='NETWORK_ERROR'}});
async function loadProfile(userId:string):Promise<Result<SessionUser>>{
 const {data,error}=await getBrowserClient().from('profiles').select('id,nickname,role').eq('id',userId).maybeSingle();
 if(error)return failure('NETWORK_ERROR');
 if(!data)return failure('FORBIDDEN');
 return {ok:true,data:{userId:data.id,role:data.role as SessionUser['role'],nickname:data.nickname}};
}
function SupabaseSessionProvider({children}:{children:ReactNode}) {
 const [state,setState]=useState<SessionState>({status:'loading'}); const listeners=useRef(new Set<(state:SessionState)=>void>()); const current=useRef<string|null>(null);
 useEffect(()=>{
  const client=getBrowserClient(); let active=true;
  const apply=async(userId:string|null)=>{
   if(!userId){current.current=null;if(active)setState({status:'signedOut'});return;}
   if(current.current===userId)return;
   const profile=await loadProfile(userId);
   if(!active)return;
   if(profile.ok){current.current=userId;setState({status:'signedIn',user:profile.data});}
   else{current.current=null;await client.auth.signOut();setState({status:'signedOut'});}
  };
  void client.auth.getSession().then(({data})=>apply(data.session?.user.id??null)).catch(()=>{if(active)setState({status:'signedOut'});});
  const {data:sub}=client.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'){if(current.current)window.dispatchEvent(new Event('session-reset'));current.current=null;setState({status:'signedOut'});return;}
   if(event==='INITIAL_SESSION')return;
   if(session?.user.id&&session.user.id!==current.current)void apply(session.user.id);
  });
  return()=>{active=false;sub.subscription.unsubscribe();};
 },[]);
 const signIn=useCallback(async(email:string,password:string):Promise<Result<SessionUser>>=>{
  const client=getBrowserClient();
  window.dispatchEvent(new Event('session-reset'));
  const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});
  if(error||!data.user)return failure(error?.status===400||error?.status===401?'UNAUTHENTICATED':'NETWORK_ERROR',error?.message??'');
  const profile=await loadProfile(data.user.id);
  if(!profile.ok){await client.auth.signOut();return profile;}
  current.current=data.user.id;setState({status:'signedIn',user:profile.data});
  return profile;
 },[]);
 const signOut=useCallback(async()=>{window.dispatchEvent(new Event('session-reset'));current.current=null;await getBrowserClient().auth.signOut();setState({status:'signedOut'});},[]);
 const onSessionChange=useCallback((cb:(s:SessionState)=>void)=>{listeners.current.add(cb);return ()=>{listeners.current.delete(cb);};},[]);
 useEffect(()=>{listeners.current.forEach(cb=>cb(state));},[state]);
 const value=useMemo(()=>({...state,signIn,signOut,onSessionChange}) as Context,[state,signIn,signOut,onSessionChange]);
 return <C.Provider value={value}>{children}</C.Provider>;
}
export function SessionProvider({children}:{children:ReactNode}){return dataMode==='supabase'?<SupabaseSessionProvider>{children}</SupabaseSessionProvider>:<MockSessionProvider>{children}</MockSessionProvider>;}
export { dataMode };
export function useSession():Context { const value=useContext(C); if(!value) throw new Error('SessionProvider missing'); return value; }
