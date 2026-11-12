'use client';
import {createContext,useContext,useEffect,useMemo,useRef,type ReactNode} from 'react';
import type {Membership,Message,Page,Result,RoomCatalogItem,RoundGaugeSummary,SubmitMessageData,SubscribeStatus,ReconcileRoomMessagesData,MessageChangeCursor,Verification,InfluencerType,InboxPage,RoomDailyBlockCount,RoomGreeting,MyInfluencerProfile} from './types';
export type ChatApi = {
 getMyVerifications(input?:{cursor?:string;limit?:number}):Promise<Result<Page<Verification>>>;
 getPendingVerifications(input?:{cursor?:string;limit?:number}):Promise<Result<Page<Verification>>>;
 requestVerification(input:{requestId:string;type:InfluencerType;evidenceUrl:string}):Promise<Result<{verification:Verification}>>;
 approveVerification(input:{requestId:string;verificationId:string;decision:'approved'|'rejected';reason?:string}):Promise<Result<{verification:Verification;verifiedAt:string|null}>>;
 getRoomInbox(input:{roomId:string;includeAnswered?:boolean;cursor?:string|null;limit?:number}):Promise<Result<InboxPage>>;
 getRoomDailyBlockCount(input:{roomId:string}):Promise<Result<RoomDailyBlockCount>>;
 replyToMessage(input:{requestId:string;roomId:string;replyTo:string;expectedClusterId:string|null;expectedClusterVersion:number|null;body:string}):Promise<Result<Message>>;
 sendBroadcast(input:{requestId:string;roomId:string;body:string}):Promise<Result<Message>>;
 deleteInfluencerMessage(input:{requestId:string;roomId:string;messageId:string}):Promise<Result<{message:Message}>>;
 advanceDemoMonth(input:{requestId:string;targetMonth:string}):Promise<Result<{closedMonth:string;currentMonth:string;applied:boolean;members:{roomId:string;userId:string;roundCount:number;previousGauge:number;gauge:number;status:'active'|'left'}[]}>>;
 getRoomFilters(input:{roomId:string}):Promise<Result<{roomId:string;disabledFilters:string[];mandatoryFilters:string[];version:number}>>;
 updateRoomFilters(input:{requestId:string;roomId:string;disabledFilters:string[];expectedVersion:number}):Promise<Result<{roomId:string;disabledFilters:string[];version:number}>>;
 getRoomGreeting(input:{roomId:string}):Promise<Result<RoomGreeting>>;
 updateRoomGreeting(input:{requestId:string;roomId:string;expectedVersion:number;text:string}):Promise<Result<RoomGreeting>>;
 getMyInfluencerProfile():Promise<Result<MyInfluencerProfile>>;
 uploadInfluencerProfilePhoto(input:{requestId:string;file:File}):Promise<Result<MyInfluencerProfile>>;
 clusterQuestions(input:{requestId:string;roomId:string}):Promise<Result<{roomId:string;clusters:{id:string;representative:string;memberCount:number;messageIds:string[]}[]}>>;
 summarizeRoom(input:{requestId:string;roomId:string}):Promise<Result<{roomId:string;summary:string;sourceMessageIds:string[];generatedAt:string}>>;
 getRooms():Promise<Result<{items:RoomCatalogItem[]}>>;
 getMyMembership(input:{roomId:string}):Promise<Result<Membership|null>>;
 joinRoom(input:{requestId:string;roomId:string}):Promise<Result<{membership:Membership;alreadyActive:boolean;welcomeMessage:Message|null}>>;
 getMyRoundGaugeSummary():Promise<Result<RoundGaugeSummary>>;
 getMessages(input:{roomId:string;beforeId?:string;afterId?:string;limit?:number}):Promise<Result<Page<Message>>>;
 subscribeRoomMessages(input:{roomId:string;onMessage:(message:Message)=>void;onStatus:(status:SubscribeStatus,error?:Error)=>void}):()=>void;
 reconcileRoomMessages(input:{roomId:string;currentMessages:readonly Message[];checkpoint:MessageChangeCursor|null}):Promise<Result<ReconcileRoomMessagesData>>;
 submitMessage(input:{requestId:string;roomId:string;body:string;suggestionToken?:string}):Promise<Result<SubmitMessageData>>;
};
const Context=createContext<ChatApi|null>(null);
export function ChatApiProvider({api,children}:{api:ChatApi;children:ReactNode}){const epoch=useRef(0);useEffect(()=>{const reset=()=>{epoch.current++;};window.addEventListener('session-reset',reset);return()=>window.removeEventListener('session-reset',reset);},[]);const wrapped=useMemo(()=>new Proxy(api,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return (...args:unknown[])=>{const current=epoch.current;const result=Reflect.apply(value,target,args);if(result instanceof Promise)return result.then((response:unknown)=>{if(current===epoch.current&&response&&typeof response==='object'&&'ok' in response&&response.ok===false&&'error' in response){const error=response.error as {code?:string};if(error?.code==='UNAUTHENTICATED')window.dispatchEvent(new Event('auth-required'));}return response;});return result;};}}),[api]);return <Context.Provider value={wrapped}>{children}</Context.Provider>;}

export function useChatApi(){const api=useContext(Context);if(!api)throw new Error('ChatApiProvider missing');return api;}
