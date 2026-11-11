import { aiAdapter } from '../_shared/ai_adapter.ts';
import { ApiFailure, assertKeys, payloadHash, rpc, serve, success, uuid, type ActorContext } from '../_shared/http.ts';

type Begin={state:'processing'|'succeeded'|'failed';leaseToken?:string;cachedResult?:Record<string,unknown>};
type Source={items:{id:string;body:string;sender:string}[];sourceMessageIds:string[]};
serve(async(_request,context:ActorContext,input,headers)=>{
  assertKeys(input,['requestId','roomId']);if(!uuid(input.requestId)||!uuid(input.roomId)) throw new ApiFailure('VALIDATION_ERROR');
  const requestId=String(input.requestId),roomId=String(input.roomId),operation='summary';
  const hash=await payloadHash(context.serviceClient,{roomId,operation});
  const begin=await rpc<Begin>(context.serviceClient,'begin_room_ai_operation',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation,p_request_id:requestId,p_payload_hash:hash});
  if(begin.state==='succeeded'){if(begin.cachedResult?.error) throw new ApiFailure(String(begin.cachedResult.error));return success(begin.cachedResult,200,headers);}
  if(begin.state!=='processing'||!begin.leaseToken) throw new ApiFailure('INTERNAL_ERROR');
  try{
    const source=await rpc<Source>(context.serviceClient,'get_room_ai_source',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation});
    let summary='';
    if(source.items.length){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);try{summary=await aiAdapter.summarize({messages:source.items,signal:controller.signal});}finally{clearTimeout(timer);}}
    if(typeof summary!=='string'||Array.from(summary).length>2000) throw new ApiFailure('FILTER_UNAVAILABLE');
    const result=await rpc(context.serviceClient,'finish_room_ai_operation',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation,p_request_id:requestId,p_payload_hash:hash,p_lease_token:begin.leaseToken,p_source_message_ids:source.sourceMessageIds,p_result:{summary}});
    return success(result,200,headers);
  }catch(error){
    try{await rpc(context.serviceClient,'fail_room_ai_operation',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation,p_request_id:requestId,p_lease_token:begin.leaseToken,p_error_code:error instanceof ApiFailure?error.code:'FILTER_UNAVAILABLE'});}catch{/* lease expiry permits a safe retry */}
    throw error;
  }
});
