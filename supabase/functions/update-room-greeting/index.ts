import { aiAdapter, validateModeration } from '../_shared/ai_adapter.ts';
import { ApiFailure, assertKeys, boundedText, failure, payloadHash, rpc, serve, success, uuid, type ActorContext } from '../_shared/http.ts';

type Begin={state:'processing'|'succeeded'|'failed';leaseToken?:string;cachedResult?:Record<string,unknown>};
const mandatoryOnly=['profanity','belittling','appearance'];

serve(async(_request,context:ActorContext,input,headers)=>{
  assertKeys(input,['requestId','roomId','expectedVersion','text']);
  if(!uuid(input.requestId)||!uuid(input.roomId)||!Number.isInteger(input.expectedVersion)||Number(input.expectedVersion)<1) throw new ApiFailure('VALIDATION_ERROR');
  const requestId=String(input.requestId);const roomId=String(input.roomId);const expectedVersion=Number(input.expectedVersion);const text=boundedText(input.text,200,true);
  const hash=await payloadHash(context.serviceClient,{roomId,expectedVersion,text});
  const begin=await rpc<Begin>(context.serviceClient,'begin_influencer_message_submission',{p_actor_id:context.actorId,p_room_id:roomId,p_request_id:requestId,p_kind:'greeting',p_payload_hash:hash});
  if(begin.state==='succeeded'){
    const cached=begin.cachedResult??{};if(cached.ok===false) return failure(cached.error,headers);return success(cached.data??cached,200,headers);
  }
  if(begin.state!=='processing'||!begin.leaseToken) throw new ApiFailure('INTERNAL_ERROR');
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);let verdict;
    try{verdict=validateModeration(await aiAdapter.moderateAndScore({body:text,disabledFilters:mandatoryOnly,senderType:'influencer',signal:controller.signal}),mandatoryOnly,'influencer');}
    finally{clearTimeout(timer);}
    const result=await rpc<Record<string,unknown>>(context.serviceClient,'update_room_greeting',{
      p_actor_id:context.actorId,p_room_id:roomId,p_request_id:requestId,p_payload_hash:hash,p_lease_token:begin.leaseToken,
      p_expected_version:expectedVersion,p_body:text,p_verdict:verdict.verdict,p_category:verdict.category,
    });
    if(result.ok===false) return failure(result.error,headers);return success(result.data??result,200,headers);
  }catch(error){
    try{await rpc(context.serviceClient,'fail_message_submission',{p_actor_id:context.actorId,p_request_id:requestId,p_lease_token:begin.leaseToken,p_error_code:error instanceof ApiFailure?error.code:'FILTER_UNAVAILABLE',p_operation:'influencer-greeting'});}catch{/* lease expiry allows safe retry */}
    throw error;
  }
});
