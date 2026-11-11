import { createAiAdapter, validateModeration } from './ai_adapter.ts';
import { fallbackModerate } from './ai/fallback.ts';
import { ApiFailure } from './http.ts';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
function expectFilterUnavailable(work:()=>unknown){let caught=false;try{work();}catch(error){caught=error instanceof ApiFailure&&error.code==='FILTER_UNAVAILABLE';}assert(caught,'expected fail-closed FILTER_UNAVAILABLE');}

Deno.test('valid pass result has no category or rewrite',()=>{
  const result=validateModeration({verdict:'pass',category:null,reason:null,rewrite:null,quality:75,rewriteQuality:null,passesAllFilters:true},[]);
  assert(result.verdict==='pass'&&result.quality===75,'valid pass result was rejected');
});

Deno.test('suggest requires an enabled optional category and safe rewrite quality',()=>{
  const result=validateModeration({verdict:'suggest',category:'profanity',reason:null,rewrite:'부드러운 표현입니다.',quality:30,rewriteQuality:88,passesAllFilters:false},[]);
  assert(result.verdict==='suggest'&&result.rewriteQuality===88,'valid suggestion was rejected');
  expectFilterUnavailable(()=>validateModeration({verdict:'suggest',category:'profanity',reason:null,rewrite:'다시 쓰기',quality:30,rewriteQuality:80,passesAllFilters:false},['profanity']));
});

Deno.test('mandatory categories cannot be suggestions and influencers cannot suggest',()=>{
  expectFilterUnavailable(()=>validateModeration({verdict:'suggest',category:'hate',reason:null,rewrite:'다시 쓰기',quality:30,rewriteQuality:80,passesAllFilters:false},[]));
  expectFilterUnavailable(()=>validateModeration({verdict:'suggest',category:'appearance',reason:null,rewrite:'다시 쓰기',quality:30,rewriteQuality:80,passesAllFilters:false},[],'influencer'));
});

const noSignal=()=>new AbortController().signal;
const localFixtureEnv={BB_USE_LOCAL_AI_FIXTURE:'true',SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_DB_URL:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'};
async function rejection(work:()=>Promise<unknown>):Promise<unknown>{try{await work();}catch(error){return error;}return undefined;}
function isFilterUnavailable(error:unknown):boolean{return error instanceof ApiFailure&&error.code==='FILTER_UNAVAILABLE';}

Deno.test('non-local env wraps provider failures as FILTER_UNAVAILABLE',async()=>{
  // Without --allow-env the real adapter's Deno.env.get throws, so every method rejects.
  const adapter=createAiAdapter({});
  assert(isFilterUnavailable(await rejection(()=>adapter.moderateAndScore({body:'테스트',disabledFilters:[],signal:noSignal()}))),'moderateAndScore must fail closed');
  assert(isFilterUnavailable(await rejection(()=>adapter.clusterQuestions({messages:[{id:'1',body:'질문'}],signal:noSignal()}))),'clusterQuestions must fail closed');
  assert(isFilterUnavailable(await rejection(()=>adapter.summarize({messages:[{id:'1',body:'질문',sender:'a'}],signal:noSignal()}))),'summarize must fail closed');
});

Deno.test('local fixture env still selects the fixture adapter',async()=>{
  const result=await createAiAdapter(localFixtureEnv).moderateAndScore({body:'[[fixture:block]]',disabledFilters:[],signal:noSignal()});
  assert(result.verdict==='block'&&result.category==='threat','fixture adapter was not selected');
});

Deno.test('wrapped errors do not carry the provider message',async()=>{
  const error=await rejection(()=>createAiAdapter({}).summarize({messages:[{id:'1',body:'질문',sender:'a'}],signal:noSignal()}));
  assert(error instanceof ApiFailure,'expected ApiFailure');
  assert(error.message===new ApiFailure('FILTER_UNAVAILABLE').message,'message must be the fixed ApiFailure message');
  assert(!/summarize_failed|PermissionDenied|env/i.test(error.message),'provider message leaked');
  assert(error.details===undefined,'details must not be carried');
  assert(error.cause===undefined,'cause must not be carried');
});

Deno.test('fallback moderation output satisfies the validateModeration contract',()=>{
  const verdictOf=(body:string,disabled:string[],sender:'user'|'influencer'='user')=>validateModeration(fallbackModerate(body,disabled),disabled,sender).verdict;
  assert(verdictOf('오늘 날씨가 좋네요',[])==='pass','clean body must pass');
  assert(verdictOf('씨발 오늘 왜 이래',[])==='suggest','profanity keyword must suggest');
  assert(verdictOf('씨발 오늘 왜 이래',['profanity'])==='pass','disabled profanity must pass');
  assert(verdictOf('바카라 사이트 추천',[])==='block','mandatory keyword must block');
  assert(verdictOf('바카라 사이트 추천',['profanity','belittling','appearance'],'influencer')==='block','influencer mandatory keyword must block');
});
