'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Result } from '@/components/chat/api/types';
export type SessionUser = { userId: string; role: 'user' | 'influencer' | 'admin'; nickname: string };
export type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: SessionUser };
export const accounts: Record<string, SessionUser> = { userA:{userId:'userA',role:'user',nickname:'팬 A'}, userB:{userId:'userB',role:'user',nickname:'팬 B'}, influencer:{userId:'influencer',role:'influencer',nickname:'인플루언서'}, pendingInfluencer:{userId:'pendingInfluencer',role:'influencer',nickname:'신청자'}, admin:{userId:'admin',role:'admin',nickname:'관리자'} };
// The sandbox cannot create the card owner's /draw route.
export function homeFor(user:SessionUser):string { return user.role==='user'?'/chat':user.role==='admin'?'/admin':'/inbox'; }
type Context = SessionState & { signIn:(email:string,password:string)=>Promise<Result<SessionUser>>; signOut:()=>Promise<void>; onSessionChange:(cb:(state:SessionState)=>void)=>()=>void };
const C = createContext<Context | null>(null);
export function SessionProvider({children}:{children:ReactNode}) {
 const [state,setState]=useState<SessionState>({status:'loading'}); const listeners=useRef(new Set<(state:SessionState)=>void>());
 useEffect(()=>{let user:SessionUser|undefined; try {const key=sessionStorage.getItem('birdiebuddy-mock-account'); if(key) user=accounts[key];} catch {} setState(user?{status:'signedIn',user}:{status:'signedOut'});},[]);
 const signIn=useCallback(async (key:string,_password:string):Promise<Result<SessionUser>>=>{ const user=accounts[key]; if(!user) return {ok:false,error:{code:'VALIDATION_ERROR',message:'',retryable:false}}; window.dispatchEvent(new Event('session-reset')); try {sessionStorage.setItem('birdiebuddy-mock-account',key);} catch {} setState({status:'signedIn',user}); return {ok:true,data:user}; },[]);
 const signOut=useCallback(async()=>{window.dispatchEvent(new Event('session-reset'));try {sessionStorage.removeItem('birdiebuddy-mock-account');} catch {} setState({status:'signedOut'});},[]);
 const onSessionChange=useCallback((cb:(s:SessionState)=>void)=>{listeners.current.add(cb);return ()=>{listeners.current.delete(cb);};},[]);
 useEffect(()=>{listeners.current.forEach(cb=>cb(state));},[state]);
 const value=useMemo(()=>({...state,signIn,signOut,onSessionChange}) as Context,[state,signIn,signOut,onSessionChange]);
 return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSession():Context { const value=useContext(C); if(!value) throw new Error('SessionProvider missing'); return value; }
