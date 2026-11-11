import { aiAdapter } from '../_shared/ai_adapter.ts';
import { ApiFailure, assertKeys, payloadHash, rpc, serve, success, uuid, type ActorContext } from '../_shared/http.ts';

type Begin={state:'processing'|'succeeded'|'failed';leaseToken?:string;cachedResult?:Record<string,unknown>};
type Source={items:{id:string;body:string;sender:string}[];sourceMessageIds:string[]};
type Cluster={representative:string;messageIds:string[]};
serve(async(_request,context:ActorContext,input,headers)=>{
  assertKeys(input,['requestId','roomId']);if(!uuid(input.requestId)||!uuid(input.roomId)) throw new ApiFailure('VALIDATION_ERROR');
  const requestId=String(input.requestId),roomId=String(input.roomId),operation='cluster';
  const hash=await payloadHash(context.serviceClient,{roomId,operation});
  const begin=await rpc<Begin>(context.serviceClient,'begin_room_ai_operation',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation,p_request_id:requestId,p_payload_hash:hash});
  if(begin.state==='succeeded'){if(begin.cachedResult?.error) throw new ApiFailure(String(begin.cachedResult.error));return success(begin.cachedResult,200,headers);}
  if(begin.state!=='processing'||!begin.leaseToken) throw new ApiFailure('INTERNAL_ERROR');
  try{
    const source=await rpc<Source>(context.serviceClient,'get_room_ai_source',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation});
    let clusters:Cluster[]=[];
    if(source.items.length>=2){
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
      try{clusters=await aiAdapter.clusterQuestions({messages:source.items.map(({id,body})=>({id,body})),signal:controller.signal});}finally{clearTimeout(timer);}
    }
    if(!Array.isArray(clusters)) throw new ApiFailure('FILTER_UNAVAILABLE');
    const sourceSet=new Set(source.sourceMessageIds);const used=new Set<string>();
    for(const cluster of clusters){
      if(!cluster||typeof cluster.representative!=='string'||Array.from(cluster.representative).length<1||Array.from(cluster.representative).length>200
        ||!Array.isArray(cluster.messageIds)||cluster.messageIds.length<2) throw new ApiFailure('FILTER_UNAVAILABLE');
      for(const id of cluster.messageIds){if(typeof id!=='string'||!sourceSet.has(id)||used.has(id)) throw new ApiFailure('FILTER_UNAVAILABLE');used.add(id);}
    }
    const result=await rpc(context.serviceClient,'finish_room_ai_operation',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation,p_request_id:requestId,p_payload_hash:hash,p_lease_token:begin.leaseToken,p_source_message_ids:source.sourceMessageIds,p_result:{clusters}});
    return success(result,200,headers);
  }catch(error){
    try{await rpc(context.serviceClient,'fail_room_ai_operation',{p_actor_id:context.actorId,p_room_id:roomId,p_operation:operation,p_request_id:requestId,p_lease_token:begin.leaseToken,p_error_code:error instanceof ApiFailure?error.code:'FILTER_UNAVAILABLE'});}catch{/* lease expiry permits a safe retry */}
    throw error;
  }
});
