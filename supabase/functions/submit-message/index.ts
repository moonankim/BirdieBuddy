import { aiAdapter, validateModeration } from '../_shared/ai_adapter.ts';
import { ApiFailure, assertKeys, boundedText, payloadHash, rpc, serve, success, uuid, type ActorContext } from '../_shared/http.ts';

type BeginResult={state:'processing'|'succeeded'|'failed';leaseToken?:string;filterVersion?:number;disabledFilters?:string[];cachedResult?:Record<string,unknown>};

serve(async(_request,context:ActorContext,input,headers)=>{
  assertKeys(input,['requestId','roomId','body','suggestionToken']);
  if(!uuid(input.requestId)||!uuid(input.roomId)) throw new ApiFailure('VALIDATION_ERROR');
  const requestId=String(input.requestId);const roomId=String(input.roomId);const body=boundedText(input.body,2000);
  const suggestionToken=input.suggestionToken===undefined?null:input.suggestionToken;
  if(suggestionToken!==null&&(typeof suggestionToken!=='string'||suggestionToken.length>256)) throw new ApiFailure('VALIDATION_ERROR');
  const hash=await payloadHash(context.serviceClient,{roomId,body});
  const begin=await rpc<BeginResult>(context.serviceClient,'begin_message_submission',{p_actor_id:context.actorId,p_room_id:roomId,p_request_id:requestId,p_payload_hash:hash});
  if(begin.state==='succeeded'){
    const cached=begin.cachedResult??{};
    if(typeof cached.error==='string') throw new ApiFailure(cached.error,typeof cached.retryAfterSeconds==='number'?{retryAfterSeconds:cached.retryAfterSeconds}:undefined);
    return success(cached,200,headers);
  }
  if(begin.state!=='processing'||!begin.leaseToken||typeof begin.filterVersion!=='number') throw new ApiFailure('INTERNAL_ERROR');
  const leaseToken=begin.leaseToken;const filterVersion=begin.filterVersion;
  try{
    if(suggestionToken){
      const accepted=await rpc<Record<string,unknown>>(context.serviceClient,'submit_moderated_message',{
        p_actor_id:context.actorId,p_room_id:roomId,p_request_id:requestId,p_payload_hash:hash,p_lease_token:leaseToken,
        p_filter_version:filterVersion,p_body:body,p_verdict:null,p_category:null,p_quality:null,p_passes_all_filters:null,
        p_rewrite:null,p_rewrite_quality:null,p_suggestion_token:suggestionToken,
      });
      if(accepted.needsModeration!==true) return success(accepted,200,headers);
    }
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
    let verdict;
    try{
      const raw=await aiAdapter.moderateAndScore({body,disabledFilters:begin.disabledFilters??[],signal:controller.signal});
      verdict=validateModeration(raw,begin.disabledFilters??[],'user');
    }finally{clearTimeout(timer);}
    const result=await rpc<Record<string,unknown>>(context.serviceClient,'submit_moderated_message',{
      p_actor_id:context.actorId,p_room_id:roomId,p_request_id:requestId,p_payload_hash:hash,p_lease_token:leaseToken,
      p_filter_version:filterVersion,p_body:body,p_verdict:verdict.verdict,p_category:verdict.category,p_quality:verdict.quality,
      p_passes_all_filters:verdict.passesAllFilters,p_rewrite:verdict.rewrite,p_rewrite_quality:verdict.rewriteQuality,p_suggestion_token:null,
    });
    if(result.needsModeration===true) throw new ApiFailure('FILTER_UNAVAILABLE');
    return success(result,200,headers);
  }catch(error){
    try{await rpc(context.serviceClient,'fail_message_submission',{p_actor_id:context.actorId,p_request_id:requestId,p_lease_token:leaseToken,p_error_code:error instanceof ApiFailure?error.code:'FILTER_UNAVAILABLE',p_operation:'submit-message'});}catch{/* lease expires if cleanup cannot be recorded */}
    throw error;
  }
});
