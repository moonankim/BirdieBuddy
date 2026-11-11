import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';

export type ActorContext = { actorId: string; userClient: SupabaseClient<any>; serviceClient: SupabaseClient<any> };
export type ApiErrorBody = { code: string; message: string; retryable: boolean; details?: Record<string, unknown> };

const fixedMessages: Record<string,string> = {
  UNAUTHENTICATED:'다시 로그인해 주세요.', FORBIDDEN:'이 작업을 수행할 권한이 없습니다.', NOT_FOUND:'요청한 항목을 찾을 수 없습니다.',
  VALIDATION_ERROR:'입력 값을 확인해 주세요.', IDEMPOTENCY_CONFLICT:'같은 요청 ID가 다른 내용에 사용되었습니다.', REQUEST_IN_PROGRESS:'요청을 처리 중입니다.',
  ROOM_INACTIVE:'현재 이 채팅방을 이용할 수 없습니다.', FILTERS_CHANGED:'필터 설정이 바뀌었습니다. 메시지를 다시 확인해 주세요.',
  SOURCE_CHANGED:'질문 목록이 바뀌었습니다. 목록을 새로 읽어 주세요.', RATE_LIMITED:'잠시 후 다시 시도해 주세요.',
  FILTER_UNAVAILABLE:'안전 필터를 사용할 수 없어 메시지를 저장하지 않았습니다.', MESSAGE_BLOCKED:'안전 기준에 맞지 않는 메시지입니다.',
  INTERNAL_ERROR:'요청을 처리하지 못했습니다.', NETWORK_ERROR:'네트워크 요청에 실패했습니다.',
};
const retryable = new Set(['REQUEST_IN_PROGRESS','FILTERS_CHANGED','SOURCE_CHANGED','RATE_LIMITED','FILTER_UNAVAILABLE','INTERNAL_ERROR','NETWORK_ERROR']);
const statusByCode: Record<string,number> = {UNAUTHENTICATED:401,FORBIDDEN:403,NOT_FOUND:404,VALIDATION_ERROR:400,IDEMPOTENCY_CONFLICT:409,REQUEST_IN_PROGRESS:409,FILTERS_CHANGED:409,SOURCE_CHANGED:409,RATE_LIMITED:429,FILTER_UNAVAILABLE:503,MESSAGE_BLOCKED:400,ROOM_INACTIVE:403,INTERNAL_ERROR:500,NETWORK_ERROR:503};

export class ApiFailure extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(code: string, details?: Record<string, unknown>) { super(fixedMessages[code] ?? fixedMessages.INTERNAL_ERROR); this.code=code; this.details=details; }
}

export function env(name: string): string {
  const value=Deno.env.get(name);
  if(!value) throw new ApiFailure('INTERNAL_ERROR');
  return value;
}

function configured(name: string): string | null { return Deno.env.get(name) ?? null; }
function defaultKey(name: string): string | null {
  const raw=configured(name);
  if(!raw) return null;
  try {
    const value=JSON.parse(raw) as Record<string,unknown>;
    return typeof value.default==='string'?value.default:null;
  } catch { return null; }
}

export function apiError(error: unknown): ApiFailure {
  if(error instanceof ApiFailure) return error;
  const item=error as Record<string,unknown>|null;
  const code=String(item?.code==='P0001'?item?.message:item?.code??'INTERNAL_ERROR');
  let details: Record<string,unknown>|undefined;
  if(typeof item?.details==='string'){try{details=JSON.parse(item.details) as Record<string,unknown>}catch{/* ignore */}}
  return new ApiFailure(code,details);
}

export async function rpc<T>(client: SupabaseClient<any>, name: string, args: Record<string,unknown>): Promise<T> {
  const {data,error}=await client.rpc(name,args);
  if(error) throw apiError(error);
  return data as T;
}

export function json(value: unknown, status=200, headers: HeadersInit={}): Response {
  return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8',...Object.fromEntries(new Headers(headers))}});
}

export function success(data: unknown,status=200,headers: HeadersInit={}): Response { return json({ok:true,data},status,headers); }
export function failure(error: unknown,headers: HeadersInit={}): Response {
  const err=apiError(error);const body: ApiErrorBody={code:err.code,message:err.code==='MESSAGE_BLOCKED'&&typeof err.details?.reason==='string'?String(err.details.reason):err.message,retryable:retryable.has(err.code),...(err.details?{details:err.details}:{})};
  return json({ok:false,error:body},statusByCode[err.code]??500,headers);
}

function corsHeaders(origin: string | null): Headers {
  const configuredOrigins=(Deno.env.get('ALLOWED_ORIGINS')??'http://localhost:3000,http://127.0.0.1:3000').split(',').map(x=>x.trim()).filter(Boolean);
  const allowed=origin&&configuredOrigins.includes(origin)?origin:'';
  return new Headers({'access-control-allow-origin':allowed,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-max-age':'86400','vary':'Origin'});
}

export function serve(handler: (request: Request, context: ActorContext, input: Record<string,unknown>, headers: Headers) => Promise<Response>): void {
  Deno.serve(async(request)=>{
    const headers=corsHeaders(request.headers.get('origin'));
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if(request.method!=='POST') return failure(new ApiFailure('VALIDATION_ERROR'),headers);
    if(request.headers.get('origin')&&!headers.get('access-control-allow-origin')) return failure(new ApiFailure('FORBIDDEN'),headers);
    try{
      const length=Number(request.headers.get('content-length')??0);if(length>16*1024) throw new ApiFailure('VALIDATION_ERROR');
      const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>16*1024) throw new ApiFailure('VALIDATION_ERROR');
      let input:Record<string,unknown>;try{input=JSON.parse(raw)}catch{throw new ApiFailure('VALIDATION_ERROR')}
      if(!input||Array.isArray(input)||typeof input!=='object') throw new ApiFailure('VALIDATION_ERROR');
      const authorization=request.headers.get('authorization')??'';const token=authorization.match(/^Bearer\s+(.+)$/i)?.[1];if(!token) throw new ApiFailure('UNAUTHENTICATED');
      const url=configured('SUPABASE_URL')??configured('BB_LOCAL_SUPABASE_URL');
      const publicKey=defaultKey('SUPABASE_PUBLISHABLE_KEYS')??configured('SUPABASE_PUBLISHABLE_KEY')??configured('BB_LOCAL_PUBLISHABLE_KEY')??configured('SUPABASE_ANON_KEY');
      const secretKey=defaultKey('SUPABASE_SECRET_KEYS')??configured('SUPABASE_SECRET_KEY')??configured('BB_SUPABASE_SECRET_KEY')??configured('BB_LOCAL_SECRET_KEY')??configured('SUPABASE_INTERNAL_SECRET_KEY');
      if(!url||!publicKey||!secretKey) throw new ApiFailure('INTERNAL_ERROR');
      const userClient=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
      const {data,error}=await userClient.auth.getUser(token);if(error||!data.user) throw new ApiFailure('UNAUTHENTICATED');
      const serviceClient=createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
      return await handler(request,{actorId:data.user.id,userClient,serviceClient},input,headers);
    }catch(error){
      console.error('Edge request failed:',error instanceof ApiFailure?error.code:error instanceof Error?error.name:'unknown');
      return failure(error,headers);
    }
  });
}

export function assertKeys(input: Record<string,unknown>, allowed: string[]): void {
  if(Object.keys(input).some(key=>!allowed.includes(key))) throw new ApiFailure('VALIDATION_ERROR');
}

export function uuid(value: unknown): value is string { return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

export function boundedText(value: unknown,max=2000,allowEmpty=false): string {
  if(typeof value!=='string') throw new ApiFailure('VALIDATION_ERROR');
  const trimmed=value.trim();const length=Array.from(trimmed).length;
  if((!allowEmpty&&length<1)||length>max) throw new ApiFailure('VALIDATION_ERROR');
  return trimmed;
}

export async function payloadHash(client: SupabaseClient<any>, payload: Record<string,unknown>): Promise<string> {
  return rpc<string>(client,'internal_hash_payload',{p_payload:payload});
}
