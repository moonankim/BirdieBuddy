'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Modal,Button,Spinner} from '@/components/ui';
import {OwnedRoom} from '@/components/chat/owned-room';
import {Guard} from '@/components/chat/shell';
import {useChatApi} from '@/components/chat/api/chat-api';
import {RetryButton} from '@/components/chat/retry-button';
import {useRequest} from '@/components/chat/hooks/use-request';
import {useRoomMessages} from '@/components/chat/use-room-messages';
import {badgeLabel,errorText} from '@/components/chat/copy';
import {InfluencerOpenNotice} from '@/components/chat/influencer-open-notice';
import type {InboxItem,InboxPage,Message,ApiError,Result} from '@/lib/api/types';

// 계약 1.6 §6.1·§8.3: 인박스는 question/cluster 항목이 섞인 한 목록이며 revision이 다른 페이지는 합치지 않는다.
// 답변은 항목의 replyTo·expectedClusterId·expectedClusterVersion을 그대로 보낸다.
type ReplyInput={roomId:string;replyTo:string;expectedClusterId:string|null;expectedClusterVersion:number|null;body:string};
const networkError=(): {ok:false;error:ApiError}=>({ok:false,error:{code:'NETWORK_ERROR',message:'',retryable:true}});
const SOURCE_CHANGED_NOTICE='질문 목록이 바뀌어 다시 불러왔어요. 답변할 질문을 확인하고 다시 보내 주세요.';

function Inbox({roomId}:{roomId:string}){
  const api=useChatApi();
  const listGeneration=useRef(0);
  const [items,setItems]=useState<InboxItem[]|null>(null);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [listError,setListError]=useState<ApiError|null>(null);
  const [listNotice,setListNotice]=useState('');
  const [morePending,setMorePending]=useState(false);
  const [includeAnswered,setIncludeAnswered]=useState(false);
  const [count,setCount]=useState<number|null>(null);
  const [countError,setCountError]=useState<ApiError|null>(null);
  const [summary,setSummary]=useState('');
  const [body,setBody]=useState('');
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [replyKey,setReplyKey]=useState<string|null>(null);
  const [reply,setReply]=useState('');
  const {messages,applyLocal}=useRoomMessages(roomId);
  // 여기까지 읽었어요(PRD 4절): 이번에 열었을 때 NEW였던 질문은 인박스에 있는 동안 계속 NEW로 보인다. 다시 열면 그 사이 들어온 것만 NEW다.
  const [newKeys,setNewKeys]=useState<ReadonlySet<string>>(new Set());
  const [newCount,setNewCount]=useState<number|null>(null);
  const checkedRoom=useRef<string|null>(null);
  const noteNew=useCallback((page:InboxPage)=>{
    const fresh=page.items.filter(item=>item.isNew&&!item.answered).map(item=>item.inboxKey);
    if(fresh.length)setNewKeys(previous=>new Set([...previous,...fresh]));
    if(checkedRoom.current===roomId)return;
    checkedRoom.current=roomId;setNewCount(page.newCount);
    if(page.checkedThroughMessageId)void api.markInboxChecked({roomId,lastCheckedMessageId:page.checkedThroughMessageId}).catch(()=>{});
  },[api,roomId]);

  const load=useCallback(async()=>{
    const generation=++listGeneration.current;
    const [inbox,blocks]=await Promise.all([
      api.getRoomInbox({roomId,includeAnswered,limit:50}).catch(networkError),
      api.getRoomDailyBlockCount({roomId}).catch(networkError),
    ]);
    if(generation!==listGeneration.current)return;
    if(inbox.ok){setItems(inbox.data.items);setNextCursor(inbox.data.nextCursor);setListError(null);noteNew(inbox.data);}
    else setListError(inbox.error);
    if(blocks.ok){setCount(blocks.data.count);setCountError(null);}else setCountError(blocks.error);
  },[api,includeAnswered,roomId,noteNew]);

  useEffect(()=>{
    const version=listGeneration;
    setItems(null);setNextCursor(null);setListNotice('');
    void load();
    const reset=()=>{version.current++;};
    window.addEventListener('session-reset',reset);
    return()=>{version.current++;window.removeEventListener('session-reset',reset);};
  },[load]);

  const loadMore=async()=>{
    if(!nextCursor)return;
    setMorePending(true);
    const generation=listGeneration.current;
    try{
      const r:Result<InboxPage>=await api.getRoomInbox({roomId,includeAnswered,cursor:nextCursor,limit:50}).catch(networkError);
      if(generation!==listGeneration.current)return;
      if(r.ok){setItems(previous=>[...(previous??[]),...r.data.items]);setNextCursor(r.data.nextCursor);noteNew(r.data);}
      else if(r.error.code==='SOURCE_CHANGED'){setListNotice(SOURCE_CHANGED_NOTICE);await load();}
      else setListError(r.error);
    }finally{setMorePending(false);}
  };

  const broadcast=useCallback((input:{requestId:string;roomId:string;body:string})=>api.sendBroadcast(input),[api]);
  const send=useRequest<{roomId:string;body:string},Message>(broadcast);
  const answer=useCallback((input:ReplyInput&{requestId:string})=>api.replyToMessage(input),[api]);
  const response=useRequest<ReplyInput,Message>(answer);
  const clusterCall=useCallback((input:{requestId:string;roomId:string})=>api.clusterQuestions(input),[api]);
  const clustering=useRequest<{roomId:string},{roomId:string;clusters:{id:string;representative:string;memberCount:number;messageIds:string[]}[]}>(clusterCall);
  const summaryCall=useCallback((input:{requestId:string;roomId:string})=>api.summarizeRoom(input),[api]);
  const summarizing=useRequest<{roomId:string},{roomId:string;summary:string;sourceMessageIds:string[];generatedAt:string}>(summaryCall);
  const remove=useCallback((input:{requestId:string;roomId:string;messageId:string})=>api.deleteInfluencerMessage(input),[api]);
  const deletion=useRequest<{roomId:string;messageId:string},{message:Message}>(remove);

  const afterAnswer=async(r:Result<Message>)=>{
    if(r.ok){applyLocal(r.data);setReply('');setReplyKey(null);setListNotice('');await load();return;}
    if(r.error.code==='ALREADY_REPLIED'){setReplyKey(null);await load();return;}
    if(r.error.code==='SOURCE_CHANGED'){response.reset();setListNotice(SOURCE_CHANGED_NOTICE);await load();}
  };
  const submitAnswer=async(item:InboxItem)=>{
    setListNotice('');
    await afterAnswer(await response.run({roomId,replyTo:item.replyTo,expectedClusterId:item.expectedClusterId,expectedClusterVersion:item.expectedClusterVersion,body:reply}));
  };
  const afterCluster=async(r:Result<{clusters:unknown[]}>)=>{if(r.ok){setSummary(r.data.clusters.length?'묶기를 완료했어요.':'묶을 질문이 없어요.');await load();}};
  const bodyOf=(id:string)=>messages.find(m=>m.id===id)?.body;

  const answerForm=(item:InboxItem)=><form className="stack" onSubmit={async e=>{e.preventDefault();await submitAnswer(item);}}>
    <label className="field-label stack">{item.kind==='cluster'?'묶음 답변':'답변'}<textarea className="input" value={reply} onChange={e=>setReply(e.target.value)}/></label>
    {item.kind==='cluster'&&<p className="footnote !mt-0">이 묶음의 질문자 {item.memberCount}명에게 한 번에 답변해요.</p>}
    <div className="flex flex-wrap gap-2"><button className="button" disabled={response.pending||!reply.trim()||Array.from(reply).length>2000}>답변 보내기</button><button type="button" onClick={()=>{setReplyKey(null);response.reset();}}>취소</button></div>
  </form>;

  return <>
    <Modal open={deleteId!==null} title="메시지 삭제" onClose={()=>{deletion.reset();setDeleteId(null);}}>
      <p>삭제하면 되돌릴 수 없어요. 팬 화면에는 &apos;삭제된 메시지&apos;로 보여요.</p>
      <Button type="button" disabled={deletion.pending} onClick={async()=>{if(!deleteId)return;const r=await deletion.run({roomId,messageId:deleteId});if(r.ok){applyLocal(r.data.message);setDeleteId(null);await load();}}}>삭제</Button>{' '}
      <button type="button" onClick={()=>{deletion.reset();setDeleteId(null);}}>취소</button>
      {deletion.error&&<p role="alert" className="notice error">{errorText(deletion.error.code,deletion.error.details)} <RetryButton error={deletion.error} pending={deletion.pending} onRetry={async()=>{const r=await deletion.retry();if(r.ok){applyLocal(r.data.message);setDeleteId(null);await load();}}}/></p>}
    </Modal>

    <h1 className="page-title">인박스</h1>
    <InfluencerOpenNotice roomId={roomId}/>
    <nav className="my-3 flex gap-2"><Link className="button small secondary no-underline" href="/inbox/settings">설정</Link><Link className="button small secondary no-underline" href="/inbox/verification">인증 신청</Link></nav>
    {countError?<p role="alert" className="notice error">{errorText(countError.code,countError.details)} {countError.retryable&&<button onClick={()=>void load()}>다시 시도</button>}</p>
      :count===null?<Spinner label="차단 수를 불러오는 중..."/>:<p className="notice my-3">오늘 AI가 {count}건을 걸러냈어요</p>}

    <form className="card stack my-3" onSubmit={async e=>{e.preventDefault();const r=await send.run({roomId,body});if(r.ok){applyLocal(r.data);setBody('');}}}>
      <label>전체 메시지<textarea className="input" value={body} onChange={e=>setBody(e.target.value)}/></label>
      <p className="footnote !mt-0">지금 입장 중인 팬 모두에게 보여요.</p>
      <button className="button" disabled={send.pending||!body.trim()||Array.from(body).length>2000}>전체 메시지 보내기</button>
      {send.error&&<p role="alert" className="notice error">{errorText(send.error.code)} {send.error.retryable&&<button type="button" onClick={async()=>{const r=await send.retry();if(r.ok){applyLocal(r.data);setBody('');}}}>다시 시도</button>}</p>}
    </form>

    <div className="my-4 flex flex-wrap gap-2">
      <button disabled={clustering.pending||summarizing.pending} onClick={async()=>afterCluster(await clustering.run({roomId}))}>비슷한 질문 묶기</button>
      <button disabled={clustering.pending||summarizing.pending} onClick={async()=>{const r=await summarizing.run({roomId});if(r.ok)setSummary(r.data.summary);}}>대화 요약</button>
    </div>
    {/* 요약은 흐름·화제·질문을 줄바꿈으로 구분한 평문이다(문환P_plan 6.7). 줄바꿈을 유지해 표시한다. */}
    <p aria-live="polite" className={summary&&!clustering.pending&&!summarizing.pending?'card whitespace-pre-line':''}>{clustering.pending||summarizing.pending?'처리 중…':summary}</p>
    {clustering.error&&<p role="alert" className="notice error">{errorText(clustering.error.code)} {clustering.error.retryable&&<button onClick={async()=>afterCluster(await clustering.retry())}>재시도</button>}</p>}
    {summarizing.error&&<p role="alert" className="notice error">{errorText(summarizing.error.code)} {summarizing.error.retryable&&<button onClick={async()=>{const r=await summarizing.retry();if(r.ok)setSummary(r.data.summary);}}>재시도</button>}</p>}

    <label className="block my-4"><input type="checkbox" checked={includeAnswered} onChange={e=>setIncludeAnswered(e.target.checked)}/> 답변 완료 포함</label>
    {!listError&&newCount!==null&&newCount>0&&<p role="status" className="notice my-3">지난 확인 이후 새 질문 <span className="bb-count-badge">{newCount}</span>건</p>}
    {listNotice&&<p role="status" className="notice my-3">{listNotice}</p>}
    {listError&&<p role="alert" className="notice error">{errorText(listError.code,listError.details)} {listError.retryable&&<button onClick={()=>void load()}>다시 시도</button>}</p>}
    {items===null&&!listError?<Spinner label="불러오는 중..."/>
      :items?.length===0?<p className="muted py-6 text-center">질문이 없어요.</p>
      :items?.map(item=>item.kind==='question'
        ?<article className="card stack my-3" key={item.inboxKey}>
          <p>{item.question.body}</p>
          <small className="muted">{newKeys.has(item.inboxKey)&&!item.answered&&<span className="bb-new-badge mr-1">NEW</span>}{item.question.supportBadge&&item.question.supportBadge!=='none'&&<span className="badge birdie mr-1">{badgeLabel[item.question.supportBadge]}</span>}{new Date(item.question.createdAt).toLocaleString('ko-KR')} · {item.answered?'답변 완료':'미답변'}</small>
          {!item.answered&&replyKey!==item.inboxKey&&<button className="self-start" onClick={()=>{response.reset();setReply('');setReplyKey(item.inboxKey);}}>답변하기</button>}
          {replyKey===item.inboxKey&&answerForm(item)}
        </article>
        :<article className="card stack my-3" key={item.inboxKey}>
          <p className="font-bold">{item.representative} · {item.memberCount}명이 질문했어요</p>
          <small className="muted">{newKeys.has(item.inboxKey)&&!item.answered&&<span className="bb-new-badge mr-1">NEW</span>}<span className="badge mr-1">묶음</span>{item.answered?'답변 완료':'미답변'}</small>
          <details><summary className="cursor-pointer text-[length:var(--type-label)]">원 질문 {item.activeMessageIds.length}개 보기</summary><ul className="stack mt-2">{item.activeMessageIds.map(id=><li key={id} className="text-[length:var(--type-label)] text-[var(--text-secondary)]">{bodyOf(id)??'(목록에 없는 질문)'}</li>)}</ul></details>
          {!item.answered&&replyKey!==item.inboxKey&&<button className="self-start" onClick={()=>{response.reset();setReply('');setReplyKey(item.inboxKey);}}>묶음에 답변하기</button>}
          {replyKey===item.inboxKey&&answerForm(item)}
        </article>)}
    {nextCursor&&<button disabled={morePending} onClick={()=>void loadMore()}>더 보기</button>}
    {response.error&&response.error.code!=='SOURCE_CHANGED'&&<p role="alert" className="notice error">{errorText(response.error.code,response.error.details)} <RetryButton error={response.error} pending={response.pending} onRetry={async()=>afterAnswer(await response.retry())}/></p>}

    <h2 className="mt-6 text-[length:var(--type-heading)] font-bold">보낸 메시지</h2>
    {messages.filter(m=>m.messageKind==='influencer_answer'||m.messageKind==='influencer_broadcast').map(m=><article key={m.id} className="card stack my-3">
      <p>{m.deletedAt?'삭제된 메시지':m.body}</p>
      {!m.deletedAt&&<button className="button small outline" disabled={deletion.pending} onClick={()=>{deletion.reset();setDeleteId(m.id);}}>삭제</button>}
    </article>)}
  </>;
}
export default function InboxPage(){return <Guard role="influencer" verified><OwnedRoom>{roomId=><Inbox roomId={roomId}/>}</OwnedRoom></Guard>;}
