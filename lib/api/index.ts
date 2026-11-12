import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { decodeCursor, decodeVerificationCursor, encodeCursor } from './cursor.js';
import type {
  AdvanceDemoMonthData, ApiError, BackendApi, CardTemplate, CollectionItem, Grade, InboxPage, Message, MessageChangeCursor,
  MessageChangesPage, OwnedCardItem, Page, Result, RoomCatalogItem, RoomGreeting, Style, SubmitMessageData,
  UUID, Verification,
} from './types.js';

type AnyClient = SupabaseClient<any>;
type JsonRecord = Record<string, any>;

const retryableCodes = new Set(['REQUEST_IN_PROGRESS','FILTERS_CHANGED','SOURCE_CHANGED','RATE_LIMITED','FILTER_UNAVAILABLE','NETWORK_ERROR','INTERNAL_ERROR']);
const fixedMessages: Record<string,string> = {
  UNAUTHENTICATED: '다시 로그인해 주세요.', FORBIDDEN: '이 작업을 수행할 권한이 없습니다.', NOT_FOUND: '요청한 항목을 찾을 수 없습니다.',
  VALIDATION_ERROR: '입력 값을 확인해 주세요.', CONFIG_INVALID: '게임 설정을 확인할 수 없습니다.', INSUFFICIENT_CARDS: '카드가 부족합니다.',
  MAX_GRADE: '이미 최고 등급 카드입니다.', ROOM_INACTIVE: '현재 이 채팅방을 이용할 수 없습니다.', REJOIN_NOT_AVAILABLE: '이번 달 재입장 조건을 충족하지 않았습니다.',
  INVALID_MONTH_TRANSITION: '다음 달로만 이동할 수 있습니다.', IDEMPOTENCY_CONFLICT: '같은 요청 ID가 다른 내용에 사용되었습니다.', REQUEST_IN_PROGRESS: '요청을 처리 중입니다.',
  FILTERS_CHANGED: '필터 설정이 바뀌었습니다. 메시지를 다시 확인해 주세요.', SOURCE_CHANGED: '질문 목록이 바뀌었습니다. 목록을 새로 읽어 주세요.', RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
  FILTER_UNAVAILABLE: '안전 필터를 사용할 수 없어 메시지를 저장하지 않았습니다.', MESSAGE_BLOCKED: '안전 기준에 맞지 않는 메시지입니다.', ALREADY_REVIEWED: '이미 검토된 신청입니다.',
  PENDING_EXISTS: '검토 중인 신청이 있습니다.', ALREADY_REPLIED: '이미 답변한 질문입니다.', NETWORK_ERROR: '네트워크 요청에 실패했습니다.', INTERNAL_ERROR: '요청을 처리하지 못했습니다.',
};

function errorFrom(value: unknown): ApiError {
  const e = value as JsonRecord | null;
  const rawCode = String(e?.code ?? (e?.message === 'FunctionsFetchError' ? 'NETWORK_ERROR' : 'INTERNAL_ERROR'));
  const code = rawCode === 'P0001' ? String(e?.message ?? 'INTERNAL_ERROR') : rawCode;
  let details: Record<string, unknown> | undefined;
  const detailValue = e?.details;
  if (typeof detailValue === 'string') {
    try { details = JSON.parse(detailValue) as Record<string, unknown>; } catch { details = undefined; }
  } else if (detailValue && typeof detailValue === 'object') details = detailValue as Record<string, unknown>;
  if (e?.error && typeof e.error === 'object') return errorFrom(e.error);
  const message = typeof e?.message === 'string' && !['P0001','FunctionsHttpError','FunctionsRelayError'].includes(e.message)
    ? e.message : fixedMessages[code] ?? fixedMessages.INTERNAL_ERROR ?? 'Request failed.';
  return { code, message, retryable: retryableCodes.has(code), ...(details ? { details } : {}) };
}

const success = <T>(data: T): Result<T> => ({ ok: true, data });
const failure = <T>(error: unknown): Result<T> => ({ ok: false, error: errorFrom(error) });

async function run<T>(work: () => Promise<T>): Promise<Result<T>> {
  try { return success(await work()); } catch (error) { return failure(error); }
}

async function rpc<T>(client: AnyClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args ?? {});
  if (error) throw error;
  return data as T;
}

function publicUrl(client: AnyClient, bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function cardTemplate(client: AnyClient, row: JsonRecord, imagePathKey = 'image_path'): CardTemplate {
  const path = row[imagePathKey] ?? row.imagePath;
  return {
    id: String(row.id ?? row.template_id), influencerId: String(row.influencer_id ?? row.influencerId),
    influencerName: String(row.influencer_name ?? row.influencerName), influencerType: row.influencer_type ?? row.influencerType,
    verifiedAt: row.verified_at ?? row.verifiedAt ?? null, style: (row.style ?? row.template_style) as Style,
    imageUrl: publicUrl(client,'card-assets',path) ?? '',
  };
}

function message(row: JsonRecord): Message {
  return {
    id: String(row.id ?? row.id_text), roomId: String(row.roomId ?? row.room_id), senderId: String(row.senderId ?? row.sender_id),
    senderType: row.senderType ?? row.sender_type, messageKind: row.messageKind ?? row.message_kind,
    recipientUserId: row.recipientUserId ?? row.recipient_user_id ?? null, senderName: row.senderName ?? row.sender_name,
    body: row.body ?? null, replyTo: row.replyTo ?? row.reply_to_text ?? null, replyContext: row.replyContext ?? row.reply_context ?? null,
    deletedAt: row.deletedAt ?? row.deleted_at ?? null, passesAllFilters: row.passesAllFilters ?? row.passes_all_filters ?? null,
    isReplyToMe: Boolean(row.isReplyToMe ?? row.is_reply_to_me), createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at, clusterId: row.clusterId ?? row.cluster_id ?? null,
    supportBadge: row.supportBadge ?? row.support_badge ?? null,
    ownScore: row.ownScore == null && row.own_score == null ? null : Number(row.ownScore ?? row.own_score),
    qualityScore: row.qualityScore == null && row.quality_score == null ? null : Number(row.qualityScore ?? row.quality_score),
    priority: row.priority == null ? null : Number(row.priority),
  };
}

function withCardImage(client: AnyClient, row: JsonRecord): JsonRecord {
  const path = row.template?.imagePath ?? row.template?.image_path ?? row.imagePath ?? row.image_path;
  return { ...row, template: { ...row.template, imageUrl: publicUrl(client,'card-assets',path) } };
}

async function functionCall<T>(client: AnyClient, name: string, body: JsonRecord): Promise<T> {
  const { data, error } = await client.functions.invoke(name,{body});
  if (error) {
    let responseData: unknown;
    try {
      const context = (error as JsonRecord).context;
      if (context instanceof Response) responseData = await context.clone().json();
    } catch { /* response body is not JSON */ }
    throw responseData ?? error;
  }
  if (data?.ok === false) throw data.error;
  return (data?.ok === true ? data.data : data) as T;
}

export function createBackendApi(client: AnyClient): BackendApi {
  let currentChannel: RealtimeChannel | null = null;

  const api: BackendApi = {
    completeRound: (input) => run(async () => {
      const data = await rpc<JsonRecord>(client,'complete_round',{p_request_id:input.requestId,p_force_grade:input.forceGrade ?? null});
      return { ...data, template: cardTemplate(client,data.template,'imagePath') } as any;
    }),
    getCollection: () => run(async () => {
      const {data,error}=await client.from('collection_view').select('*').order('influencer_name').order('style');
      if(error) throw error;
      const grades: Grade[]=['common','rare','epic','special'];
      return {items:(data??[]).map((row:JsonRecord)=>({
        template:cardTemplate(client,row),counts:Object.fromEntries(grades.map(g=>[g,Number(row[`${g}_count`]??0)])) as Record<Grade,number>,
        totalCards:Number(row.total_cards??0),highestGrade:row.highest_grade??null,
      }))};
    }),
    getOwnedCards: () => run(async () => {
      const {data,error}=await client.from('inventory_view').select('*').order('influencer_name').order('style').order('grade');
      if(error) throw error;
      return {items:(data??[]).map((row:JsonRecord)=>({template:cardTemplate(client,row),grade:row.grade,count:Number(row.count)})) as OwnedCardItem[]};
    }),
    upgradeCard: (input) => run(()=>rpc(client,'upgrade_card',{p_request_id:input.requestId,p_template_id:input.templateId,p_grade:input.grade})),
    getRooms: () => run(async () => {
      const {data,error}=await client.from('room_catalog').select('*').order('influencer_name'); if(error) throw error;
      return {items:(data??[]).map((r:JsonRecord)=>({roomId:r.room_id,influencerId:r.influencer_id,influencerName:r.influencer_name,
        influencerType:r.influencer_type,verifiedAt:r.verified_at,profileImageUrl:publicUrl(client,'influencer-profiles',r.profile_image_path)??publicUrl(client,'card-assets',r.fallback_image_path),
        requiredCards:Number(r.required_cards),earnedCards:Number(r.earned_cards),missingCards:Number(r.missing_cards),supportBadge:r.support_badge,
        cardStatus:r.card_status,canJoin:Boolean(r.can_join),joinReason:r.join_reason,currentMonthRoundCount:Number(r.current_month_round_count),
        requiredRoundsToRejoin:Number(r.required_rounds_to_rejoin),membership:r.membership?{roomId:r.membership.room_id,status:r.membership.status,gauge:Number(r.membership.gauge),joinedAt:r.membership.joined_at,joinedMonth:r.membership.joined_month,leftAt:r.membership.left_at,leftMonth:r.membership.left_month}:null
      })) as RoomCatalogItem[]};
    }),
    joinRoom: (input)=>run(async()=>{
      const result=await rpc<JsonRecord>(client,'join_room',{p_request_id:input.requestId,p_room_id:input.roomId});
      return {...result,welcomeMessage:result.welcomeMessage?message(result.welcomeMessage):null} as any;
    }),
    getMyMembership: ({roomId})=>run(async()=>{
      const {data,error}=await client.from('room_members').select('room_id,status,gauge,joined_at,joined_month,left_at,left_month').eq('room_id',roomId).maybeSingle();
      if(error) throw error; if(!data) return null;
      return {roomId:data.room_id,status:data.status,gauge:Number(data.gauge),joinedAt:data.joined_at,joinedMonth:data.joined_month,leftAt:data.left_at,leftMonth:data.left_month} as any;
    }),
    getMyRoundGaugeSummary: ()=>run(()=>rpc(client,'get_my_round_gauge_summary')),
    advanceDemoMonth: (input)=>run(()=>rpc<AdvanceDemoMonthData>(client,'advance_demo_month',{p_request_id:input.requestId,p_target_month:input.targetMonth})),
    getMessages: (input)=>run(async()=>{
      const result=await rpc<JsonRecord>(client,'get_messages',{p_room_id:input.roomId,p_before_id:input.beforeId??null,p_after_id:input.afterId??null,p_limit:input.limit??50});
      return {items:(result.items??[]).map(message),nextCursor:result.nextCursor??null};
    }),
    submitMessage: (input)=>run(()=>functionCall<SubmitMessageData>(client,'submit-message',input as JsonRecord)),
    getRoomMessageCheckpoint: ({roomId})=>run(async()=>{
      const result=await rpc<JsonRecord|null>(client,'get_room_message_checkpoint',{p_room_id:roomId});
      return result?{updatedAt:String(result.updatedAt),id:String(result.id)}:null;
    }),
    getMessageChanges: (input)=>run<MessageChangesPage>(async()=>{
      const result=await rpc<JsonRecord>(client,'get_message_changes',{
        p_room_id:input.roomId,p_checkpoint_updated_at:input.checkpoint?.updatedAt??null,p_checkpoint_id:input.checkpoint?.id??null,
        p_through_updated_at:input.through?.updatedAt??null,p_through_id:input.through?.id??null,
        p_cursor_updated_at:input.cursor?.updatedAt??null,p_cursor_id:input.cursor?.id??null,p_limit:input.limit??50,
      });
      return {items:(result.items??[]).map(message),nextCursor:result.nextCursor?{updatedAt:result.nextCursor.updatedAt,id:String(result.nextCursor.id)}:null};
    }),
    reconcileRoomMessages: async(input)=>{
      const throughResult=await api.getRoomMessageCheckpoint({roomId:input.roomId});
      if(!throughResult.ok) return throughResult as Result<{messages:Message[];checkpoint:MessageChangeCursor|null}>;
      const through=throughResult.data; let cursor:MessageChangeCursor|null=null; const changed:Message[]=[];
      if(through){
        for(let page=0;page<1000;page+=1){
          const part=await api.getMessageChanges({roomId:input.roomId,checkpoint:input.checkpoint,through,cursor,limit:100});
          if(!part.ok) return part as Result<{messages:Message[];checkpoint:MessageChangeCursor|null}>;
          changed.push(...part.data.items); if(!part.data.nextCursor) break; cursor=part.data.nextCursor;
          if(page===999) return failure({code:'INTERNAL_ERROR',message:fixedMessages.INTERNAL_ERROR});
        }
      }
      const merged=new Map(input.currentMessages.map((m)=>[m.id,m]));
      for(const next of changed){const old=merged.get(next.id);if(!old||old.updatedAt<=next.updatedAt)merged.set(next.id,next);}
      return success({messages:[...merged.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0),checkpoint:through??input.checkpoint});
    },
    subscribeRoomMessages: (input)=>{
      let active=true; let channel:RealtimeChannel;
      let retryTimer:ReturnType<typeof setTimeout>|undefined;
      let enriching=false;
      const pending=new Map<string,JsonRecord>();
      const notifyEnrichmentError=(messageIds:string[])=>{
        try { input.onMessageEnrichmentError?.(messageIds); } catch { /* Consumer notification must not stop recovery. */ }
      };
      const scheduleRetry=()=>{
        if(!active||retryTimer||!pending.size)return;
        retryTimer=setTimeout(()=>{retryTimer=undefined;void flushPending();},3000);
      };
      const flushPending=async()=>{
        if(!active||enriching||!pending.size)return;
        enriching=true;
        let failed=false;
        try{
          while(active&&pending.size){
            const batch=[...pending.entries()].slice(0,100);
            const messageIds=batch.map(([id])=>id);
            let result:{data:unknown;error:unknown};
            try{
              result=await client.rpc('get_my_answer_links',{p_room_id:input.roomId,p_answer_ids:messageIds});
            }catch{
              notifyEnrichmentError(messageIds);failed=true;break;
            }
            if(!active)break;
            if(result.error){notifyEnrichmentError(messageIds);failed=true;break;}
            const links=(result.data as JsonRecord|null)?.items??[];
            const replyToMe=new Map<string,boolean>(links.map((row:JsonRecord)=>[String(row.answerId),Boolean(row.isReplyToMe)]));
            for(const [id,row] of batch){
              if(pending.get(id)!==row)continue;
              pending.delete(id);
              const next={...message(row),isReplyToMe:Boolean(replyToMe.get(id))};
              if(active)input.onMessage(next);
            }
          }
        }finally{
          enriching=false;
          if(active&&pending.size){
            if(failed)scheduleRetry();
            else queueMicrotask(()=>void flushPending());
          }
        }
      };
      const handler=(payload:JsonRecord)=>{
        if(!active||!payload.new||!payload.new.id_text) return;
        const next=message(payload.new);
        if(next.messageKind==='influencer_answer'){
          pending.set(next.id,payload.new);
          if(!retryTimer)void flushPending();
          return;
        }
        if(active)input.onMessage(next);
      };
      channel=client.channel(`room-messages:${input.roomId}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`room_id=eq.${input.roomId}`},(payload)=>handler(payload as JsonRecord))
        .subscribe((status,error)=>{if(active) input.onStatus(status as any,error??undefined);});
      currentChannel=channel;
      return ()=>{active=false;if(retryTimer)clearTimeout(retryTimer);pending.clear();void client.removeChannel(channel);if(currentChannel===channel)currentChannel=null;};
    },
    getRoomInbox: (input)=>run(async()=>{
      const data=await rpc<JsonRecord>(client,'get_room_inbox',{p_room_id:input.roomId,p_include_answered:input.includeAnswered??false,p_cursor:decodeCursor(input.cursor),p_limit:input.limit??50});
      return {...data,items:data.items??[],nextCursor:encodeCursor(data.nextCursor)} as InboxPage;
    }),
    replyToMessage: (input)=>run(()=>functionCall<Message>(client,'send-influencer-message',{...input,kind:'answer'} as JsonRecord)),
    sendBroadcast: (input)=>run(()=>functionCall<Message>(client,'send-influencer-message',{...input,kind:'broadcast'} as JsonRecord)),
    deleteInfluencerMessage: (input)=>run(async()=>{
      const result=await rpc<JsonRecord>(client,'delete_influencer_message',{p_request_id:input.requestId,p_room_id:input.roomId,p_message_id:input.messageId});
      return {message:message(result.message)};
    }),
    getRoomGreeting: ({roomId})=>run(()=>rpc(client,'get_room_greeting',{p_room_id:roomId})),
    updateRoomGreeting: (input)=>run(()=>functionCall<RoomGreeting>(client,'update-room-greeting',input as JsonRecord)),
    getRoomDailyBlockCount: ({roomId})=>run(()=>rpc(client,'get_room_daily_block_count',{p_room_id:roomId})),
    summarizeRoom: (input)=>run(()=>functionCall(client,'summarize-room',input as JsonRecord)),
    clusterQuestions: (input)=>run(()=>functionCall(client,'cluster-questions',input as JsonRecord)),
    requestVerification: (input)=>run(()=>rpc(client,'request_verification',{p_request_id:input.requestId,p_type:input.type,p_evidence_url:input.evidenceUrl})),
    getMyVerifications: (input)=>run(()=>queryVerifications(client,false,input?.cursor,input?.limit)),
    getPendingVerifications: (input)=>run(()=>queryVerifications(client,true,input?.cursor,input?.limit)),
    approveVerification: (input)=>run(()=>rpc(client,'approve_verification',{p_request_id:input.requestId,p_verification_id:input.verificationId,p_decision:input.decision,p_reason:input.reason??null})),
    getMyInfluencerProfile: ()=>run(async()=>{
      const result=await rpc<JsonRecord>(client,'get_my_influencer_profile');
      return {influencerId:result.influencerId,influencerName:result.influencerName,verifiedAt:result.verifiedAt,
        profileImageUrl:publicUrl(client,'influencer-profiles',result.profileImagePath),fallbackImageUrl:publicUrl(client,'card-assets',result.fallbackImagePath)};
    }),
    uploadInfluencerProfilePhoto: (input)=>run(async()=>{
      if(typeof window==='undefined'||typeof createImageBitmap==='undefined') throw {code:'VALIDATION_ERROR',message:'Photo upload is only available in a browser.'};
      if(!['image/jpeg','image/png','image/webp'].includes(input.file.type)||input.file.size>5*1024*1024) throw {code:'VALIDATION_ERROR',message:'Choose a JPEG, PNG, or WebP image up to 5 MiB.'};
      const profile=await api.getMyInfluencerProfile();if(!profile.ok) throw profile.error;
      const bitmap=await createImageBitmap(input.file);
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
      const context=canvas.getContext('2d');if(!context){bitmap.close();throw {code:'INTERNAL_ERROR'};}
      const scale=Math.max(512/bitmap.width,512/bitmap.height);const width=bitmap.width*scale;const height=bitmap.height*scale;
      context.drawImage(bitmap,(512-width)/2,(512-height)/2,width,height);bitmap.close();
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((value)=>value?resolve(value):reject(new Error('Image conversion failed.')),'image/webp',0.9));
      if(blob.size>5*1024*1024) throw {code:'VALIDATION_ERROR',message:'Converted image exceeds the 5 MiB upload limit.'};
      const bytes=new Uint8Array(await blob.arrayBuffer());const digestBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
      const digest=[...digestBytes].map((n)=>n.toString(16).padStart(2,'0')).join('');const path=`${profile.data.influencerId}/${input.requestId}.webp`;
      const bucket=client.storage.from('influencer-profiles');
      const upload=await bucket.upload(path,bytes,{contentType:'image/webp',upsert:false,cacheControl:'3600'});
      if(upload.error){const existing=await bucket.download(path);if(existing.error) throw {code:'NETWORK_ERROR',message:fixedMessages.NETWORK_ERROR};
        const existingBytes=new Uint8Array(await existing.data.arrayBuffer());const existingDigest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',existingBytes))].map((n)=>n.toString(16).padStart(2,'0')).join('');
        if(existingDigest!==digest) throw {code:'IDEMPOTENCY_CONFLICT',message:fixedMessages.IDEMPOTENCY_CONFLICT};}
      await rpc(client,'set_influencer_profile_photo',{p_request_id:input.requestId,p_profile_image_path:path,p_content_sha256:digest});
      const updated=await api.getMyInfluencerProfile();if(!updated.ok) throw updated.error;return updated.data;
    }),
    getGameConfig: ()=>run(async()=>{
      const {data,error}=await client.from('game_config').select('key,value,version,updated_at').order('key');if(error) throw error;
      return (data??[]).map((row:JsonRecord)=>({key:row.key,value:row.value,version:row.version,updatedAt:row.updated_at}));
    }),
    updateGameConfig: (input)=>run(async()=>{
      const r=await rpc<JsonRecord>(client,'update_game_config',{p_request_id:input.requestId,p_key:input.key,p_value:input.value,p_expected_version:input.expectedVersion});
      return {...r,updatedAt:r.updatedAt??r.updated_at} as any;
    }),
    getRoomFilters: ({roomId})=>run(()=>rpc(client,'get_room_filters',{p_room_id:roomId})),
    updateRoomFilters: (input)=>run(()=>rpc(client,'update_room_filters',{p_request_id:input.requestId,p_room_id:input.roomId,p_disabled_filters:input.disabledFilters,p_expected_version:input.expectedVersion})),
  };
  return api;
}

async function queryVerifications(client:AnyClient,pending:boolean,cursor:string|null|undefined,limit=50):Promise<Page<Verification>>{
  const pageSize=Math.max(1,Math.min(Number(limit??50),100));const parsed=decodeVerificationCursor(cursor);
  let query=client.from('verifications').select('id,influencer_id,type,evidence_url,status,created_at,reviewed_at,rejection_reason')
    .eq('status',pending?'pending':undefined as any);
  if(!pending) query=client.from('verifications').select('id,influencer_id,type,evidence_url,status,created_at,reviewed_at,rejection_reason');
  if(parsed?.createdAt&&parsed?.id) query=query.or(`created_at.gt.${parsed.createdAt},and(created_at.eq.${parsed.createdAt},id.gt.${parsed.id})`);
  const {data,error}=await query.order('created_at').order('id').limit(pageSize+1);if(error) throw error;
  const rows=(data??[]) as JsonRecord[];const hasMore=rows.length>pageSize;const items=rows.slice(0,pageSize).map((r)=>({id:r.id,influencerId:r.influencer_id,type:r.type,evidenceUrl:r.evidence_url,status:r.status,createdAt:r.created_at,reviewedAt:r.reviewed_at,rejectionReason:r.rejection_reason})) as Verification[];
  const last=items.at(-1);return {items,nextCursor:hasMore&&last?encodeCursor({createdAt:last.createdAt,id:last.id}):null};
}

export type { BackendApi } from './types.js';
export * from './types.js';
