import { createAiAdapter as createProviderAdapter } from './ai.ts';
import { ApiFailure } from './http.ts';

export type AiVerdict = 'pass'|'suggest'|'block';
export type ModerationResult = {
  verdict: AiVerdict;
  category: string|null;
  reason: null;
  rewrite: string|null;
  quality: number;
  rewriteQuality: number|null;
  passesAllFilters: boolean;
};

export type AiAdapter = {
  moderateAndScore(input:{body:string;disabledFilters:string[];senderType?:'user'|'influencer';signal:AbortSignal}):Promise<ModerationResult>;
  clusterQuestions(input:{messages:{id:string;body:string}[];signal:AbortSignal}):Promise<{representative:string;messageIds:string[]}[]>;
  summarize(input:{messages:{id:string;body:string;sender:string}[];signal:AbortSignal}):Promise<string>;
};

function isLocalSupabase(env: Record<string,string|undefined>): boolean {
  try {
    const api = new URL(env.SUPABASE_URL ?? '');
    const database = new URL(env.SUPABASE_DB_URL ?? '');
    const localApi = new Set(['kong','localhost','127.0.0.1','::1']);
    const localDatabase = new Set(['db','localhost','127.0.0.1','::1']);
    return localApi.has(api.hostname) && localDatabase.has(database.hostname)
      && ['5432','54322'].includes(database.port);
  } catch {
    return false;
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new ApiFailure('FILTER_UNAVAILABLE');
}

const localFixtureAdapter: AiAdapter = {
  async moderateAndScore({body,disabledFilters,senderType='user',signal}) {
    throwIfAborted(signal);
    if (body.includes('[[fixture:block]]')) {
      return {verdict:'block',category:'threat',reason:null,rewrite:null,quality:50,rewriteQuality:null,passesAllFilters:false};
    }
    if (senderType==='user' && !disabledFilters.includes('profanity') && body.includes('[[fixture:suggest]]')) {
      return {verdict:'suggest',category:'profanity',reason:null,rewrite:'조금 더 부드럽게 표현해 주세요.',quality:50,rewriteQuality:80,passesAllFilters:false};
    }
    return {verdict:'pass',category:null,reason:null,rewrite:null,quality:50,rewriteQuality:null,passesAllFilters:false};
  },
  async clusterQuestions({messages,signal}) {
    throwIfAborted(signal);
    const groups = new Map<string,{representative:string;messageIds:string[]}>();
    for (const message of messages) {
      const match = message.body.match(/\[\[fixture:cluster=([a-z0-9_-]{1,32})\]\]/i);
      if (!match) continue;
      const group = groups.get(match[1]) ?? {representative:'',messageIds:[]};
      if (!group.representative) group.representative = message.body.replace(match[0],'').trim().slice(0,200) || '로컬 묶음 질문';
      group.messageIds.push(message.id);
      groups.set(match[1],group);
    }
    return [...groups.values()].filter((group)=>group.messageIds.length>=2);
  },
  async summarize({messages,signal}) {
    throwIfAborted(signal);
    return messages.length ? `로컬 fixture 요약: ${messages.length}개 메시지가 오갔습니다.` : '';
  },
};

// Provider errors are mapped to FILTER_UNAVAILABLE without their message so provider
// details never reach the response; http.ts would otherwise turn them into a 500.
async function asFilterUnavailable<T>(work:()=>Promise<T>): Promise<T> {
  try { return await work(); } catch { throw new ApiFailure('FILTER_UNAVAILABLE'); }
}

function createWrappedProviderAdapter(): AiAdapter {
  const provider = createProviderAdapter();
  return {
    // ai.ts types reason as string|null (always null at runtime); validateModeration rejects non-null.
    moderateAndScore:(input)=>asFilterUnavailable(()=>provider.moderateAndScore(input) as Promise<ModerationResult>),
    clusterQuestions:(input)=>asFilterUnavailable(()=>provider.clusterQuestions(input)),
    summarize:(input)=>asFilterUnavailable(()=>provider.summarize(input)),
  };
}

export function createAiAdapter(env: Record<string,string|undefined>): AiAdapter {
  return env.BB_USE_LOCAL_AI_FIXTURE==='true' && isLocalSupabase(env) ? localFixtureAdapter : createWrappedProviderAdapter();
}

function runtimeEnv(name:string): string|undefined {
  try { return Deno.env.get(name); } catch { return undefined; }
}

// The local fixture is selected only for local Supabase with BB_USE_LOCAL_AI_FIXTURE=true;
// everything else uses the real provider adapter from ai.ts.
export const aiAdapter = createAiAdapter({
  BB_USE_LOCAL_AI_FIXTURE:runtimeEnv('BB_USE_LOCAL_AI_FIXTURE'),
  SUPABASE_URL:runtimeEnv('SUPABASE_URL'),
  SUPABASE_DB_URL:runtimeEnv('SUPABASE_DB_URL'),
});

export function validateModeration(value:unknown,disabledFilters:string[],senderType:'user'|'influencer'='user'):ModerationResult{
  if(!value||typeof value!=='object') throw new ApiFailure('FILTER_UNAVAILABLE');
  const v=value as Record<string,unknown>;const optional=new Set(['profanity','belittling','appearance']);
  const mandatory=new Set(['threat','stalking','sexual_harassment','privacy','hate','illegal_ad','spam']);
  if(!['pass','suggest','block'].includes(String(v.verdict))||!(v.category===null||typeof v.category==='string')
    ||v.reason!==null||typeof v.quality!=='number'||!Number.isFinite(v.quality)||v.quality<0||v.quality>100
    ||typeof v.passesAllFilters!=='boolean'||!(v.rewrite===null||typeof v.rewrite==='string')
    ||!(v.rewriteQuality===null||(typeof v.rewriteQuality==='number'&&Number.isFinite(v.rewriteQuality)&&v.rewriteQuality>=0&&v.rewriteQuality<=100))){
    throw new ApiFailure('FILTER_UNAVAILABLE');
  }
  const verdict=v.verdict as AiVerdict;const category=v.category as string|null;
  if(verdict==='pass'&&(category!==null||v.rewrite!==null||v.rewriteQuality!==null)) throw new ApiFailure('FILTER_UNAVAILABLE');
  if(verdict==='suggest'&&(!category||!optional.has(category)||disabledFilters.includes(category)||v.passesAllFilters||
    (v.rewrite!==null&&(Array.from(v.rewrite as string).length<1||Array.from(v.rewrite as string).length>2000||v.rewriteQuality===null)))) throw new ApiFailure('FILTER_UNAVAILABLE');
  if(verdict==='block'&&(!category||!mandatory.has(category)||v.passesAllFilters||v.rewrite!==null||v.rewriteQuality!==null)) throw new ApiFailure('FILTER_UNAVAILABLE');
  if(senderType==='influencer'&&verdict==='suggest') throw new ApiFailure('FILTER_UNAVAILABLE');
  return {verdict,category,reason:null,rewrite:v.rewrite as string|null,quality:v.quality,rewriteQuality:v.rewriteQuality as number|null,passesAllFilters:v.passesAllFilters};
}
