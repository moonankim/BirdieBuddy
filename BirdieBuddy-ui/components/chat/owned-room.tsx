'use client';
import type {ReactNode} from 'react';
import {useOwnedRoom} from './hooks/use-owned-room';
import {errorText,copy} from './copy';
export function OwnedRoom({children}:{children:(roomId:string)=>ReactNode}){const {state,retry}=useOwnedRoom();if(state.status==='loading'||state.status==='auth')return <p>{copy.loadingRoom}</p>;if(state.status==='forbidden')return <p>{errorText('FORBIDDEN')}</p>;if(state.status==='empty')return <p>{copy.noOwnedRoom}</p>;if(state.status==='error')return <p role="alert" className="notice error">{errorText(state.error.code,state.error.details)} {state.error.retryable&&<button onClick={retry}>다시 시도</button>}</p>;return <>{children(state.roomId)}</>;}
