'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {ApiError,Result} from '../api/types';
export function useRequest<I,T>(call:(input:I & {requestId:string})=>Promise<Result<T>>) {
 const saved=useRef<(I & {requestId:string})|null>(null);const busy=useRef(false);const generation=useRef(0);const [pending,setPending]=useState(false);const [error,setError]=useState<ApiError|null>(null);
 const reset=useCallback(()=>{generation.current++;saved.current=null;busy.current=false;setPending(false);setError(null);},[]);
 useEffect(()=>{const version=generation;window.addEventListener('session-reset',reset);return()=>{window.removeEventListener('session-reset',reset);version.current++;};},[reset]);
 const execute=useCallback(async(input:I & {requestId:string}):Promise<Result<T>>=>{if(busy.current)return {ok:false,error:{code:'REQUEST_IN_PROGRESS',message:'',retryable:true}};busy.current=true;const gen=generation.current;setPending(true);setError(null);try{const result=await call(input);if(gen!==generation.current)return {ok:false,error:{code:'UNAUTHENTICATED',message:'',retryable:false}};if(gen===generation.current){if(result.ok||!result.error.retryable)saved.current=null;if(!result.ok)setError(result.error);}return result;}catch{if(gen!==generation.current)return {ok:false,error:{code:'UNAUTHENTICATED',message:'',retryable:false}};const e={code:'NETWORK_ERROR',message:'',retryable:true};if(gen===generation.current)setError(e);return {ok:false,error:e};}finally{if(gen===generation.current){busy.current=false;setPending(false);}}},[call]);
 const run=useCallback((input:I):Promise<Result<T>>=>{if(busy.current)return Promise.resolve({ok:false,error:{code:'REQUEST_IN_PROGRESS',message:'',retryable:true}});const request={...input,requestId:crypto.randomUUID()};saved.current=request;return execute(request);},[execute]);
 const retry=useCallback(()=>saved.current?execute(saved.current):Promise.resolve({ok:false,error:{code:'VALIDATION_ERROR',message:'',retryable:false}} as Result<T>),[execute]);
 return {run,retry,pending,error,reset};
}
