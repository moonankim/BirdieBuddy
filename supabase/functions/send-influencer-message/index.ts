import { aiAdapter, validateModeration } from '../_shared/ai_adapter.ts';
import { ApiFailure, assertKeys, boundedText, failure, payloadHash, rpc, serve, success, uuid, type ActorContext } from '../_shared/http.ts';

type Kind='answer'|'broadcast';
type Begin={state:'processing'|'succeeded'|'failed';leaseToken?:string;filterVersion?:number;cachedResult?:Record<string,unknown>};
const mandatoryOnly=['profanity','belittling','appearance'];

serve(async(_request,context:ActorContext,input,headers)=>{
  const kind=input.kind;
  if(kind!=='answer'&&kind!=='broadcast') throw new ApiFailure('VALIDATION_ERROR');
  const allowed=kind==='answer'?['kind','requestId','roomId','replyTo','expectedClusterId','expectedClusterVersion','body']:['kind','requestId','roomId','body'];
  assertKeys(input,allowed);
  if(!uuid(input.requestId)||!uuid(input.roomId)) throw new ApiFailure('VALIDATION_ERROR');
  const requestId=String(input.requestId);const roomId=String(input.roomId);const body=boundedText(input.body,2000);
  let replyTo:string|null=null;let expectedClusterId:string|null=null;let expectedClusterVersion:number|null=null;
  if(kind==='answer'){
    if(typeof input.replyTo!=='string'||!/^\d{1,19}$/.test(input.replyTo)||!((input.expectedClusterId===null)||uuid(input.expectedClusterId))
      ||!((input.expectedClusterVersion===null)||(Number.isInteger(input.expectedClusterVersion)&&Number(input.expectedClusterVersion)>0))) throw new ApiFailure('VALIDATION_ERROR');
    replyTo=input.replyTo;expectedClusterId=input.expectedClusterId as string|null;expectedClusterVersion=input.expectedClusterVersion as number|null;
    if((expectedClusterId===null)!==(expectedClusterVersion===null)) throw new ApiFailure('VALIDATION_ERROR');
  }
  const hash=await payloadHash(context.serviceClient,{roomId,kind,replyTo,expectedClusterId,expectedClusterVersion,body});
  const begin=await rpc<Begin>(context.serviceClient,'begin_influencer_message_submission',{p_actor_id:context.actorId,p_room_id:roomId,p_request_id:requestId,p_kind:kind,p_payload_hash:hash});
  if(begin.state==='succeeded'){
    const cached=begin.cachedResult??{};
    if(cached.ok===false) return failure(cached.error,headers);
    return success(cached.data??cached,200,headers);
  }
  if(begin.state!=='processing'||!begin.leaseToken) throw new ApiFailure('INTERNAL_ERROR');
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);let verdict;
    try{verdict=validateModeration(await aiAdapter.moderateAndScore({body,disabledFilters:mandatoryOnly,senderType:'influencer',signal:controller.signal}),mandatoryOnly,'influencer');}
    finally{clearTimeout(timer);}
    const result=await rpc<Record<string,unknown>>(context.serviceClient,'submit_influencer_message',{
      p_actor_id:context.actorId,p_room_id:roomId,p_request_id:requestId,p_kind:kind,p_payload_hash:hash,p_lease_token:begin.leaseToken,
      p_reply_to:replyTo,p_expected_cluster_id:expectedClusterId,p_expected_cluster_version:expectedClusterVersion,p_body:body,
      p_verdict:verdict.verdict,p_category:verdict.category,
    });
    if(result.ok===false) return failure(result.error,headers);
    return success(result.data??result,200,headers);
  }catch(error){
    try{await rpc(context.serviceClient,'fail_message_submission',{p_actor_id:context.actorId,p_request_id:requestId,p_lease_token:begin.leaseToken,p_error_code:error instanceof ApiFailure?error.code:'FILTER_UNAVAILABLE',p_operation:`influencer-${kind}`});}catch{/* lease expiry allows safe retry */}
    throw error;
  }
});
