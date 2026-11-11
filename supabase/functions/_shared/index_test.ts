import { aiAdapter, validateModeration } from './ai_adapter.ts';
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

Deno.test('unmerged provider adapter fails closed',async()=>{
  let caught=false;
  try{await aiAdapter.moderateAndScore({body:'테스트',disabledFilters:[],signal:new AbortController().signal});}
  catch(error){caught=error instanceof ApiFailure&&error.code==='FILTER_UNAVAILABLE';}
  assert(caught,'provider absence must not pass a message through');
});
