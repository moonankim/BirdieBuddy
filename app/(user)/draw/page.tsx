'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Guard} from '@/components/chat/shell';
import {useChatApi} from '@/components/chat/api/chat-api';
import {useSession} from '@/lib/session';
import {CardArtwork,StatusPanel} from '@/components/ui/card-artwork';
import type {CompleteRoundData} from '@/lib/api/types';
import {gradeLabel,readLastDraw,styleLabel} from '../_lib/cards';

// 발급 결과(현호P D-06). 서버가 확정한 카드·등급·신규 여부·입장 가능을 보여 준다. 뽑기 연출은 미정(docs/design.md).
function DrawResult(){
  const api=useChatApi();const session=useSession();
  const userId=session.status==='signedIn'?session.user.userId:null;
  const [result,setResult]=useState<CompleteRoundData|null|undefined>(undefined);
  const [room,setRoom]=useState<{roomId:string;requiredCards:number}|null>(null);
  useEffect(()=>{setResult(userId?readLastDraw(userId):null);},[userId]);
  useEffect(()=>{
    if(!result?.entryUnlocked)return;let active=true;
    void api.getRooms().then(r=>{if(!active||!r.ok)return;const found=r.data.items.find(item=>item.influencerId===result.template.influencerId);setRoom(found?{roomId:found.roomId,requiredCards:found.requiredCards}:null);});
    return()=>{active=false;};
  },[api,result]);
  if(result===undefined)return <StatusPanel tone="loading" title="결과를 확인하는 중이에요"/>;
  if(result===null)return <div className="stack"><StatusPanel tone="empty" title="아직 발급 결과가 없어요">홈에서 라운드 완료를 누르면 카드가 발급돼요.</StatusPanel><Link className="button secondary no-underline" href="/home">홈으로</Link></div>;
  const {template,grade,isNew,ownedCount,entryUnlocked}=result;
  return <div className="stack">
    <div><span className="eyebrow">ROUND COMPLETE</span><h1 className="page-title">카드가 도착했어요</h1></div>
    <div className="mx-auto w-full max-w-[240px]"><CardArtwork src={template.imageUrl} name={template.influencerName} grade={grade}/></div>
    <div className="card stack text-center">
      <p className="flex flex-wrap items-center justify-center gap-2"><strong className="text-[length:var(--type-heading)]">{template.influencerName}</strong><span className={isNew?'badge birdie':'badge gray'}>{isNew?'새 카드':'중복 카드'}</span></p>
      <p className="muted">{styleLabel[template.style]} · {gradeLabel[grade]} · 이 등급 {ownedCount}장 보유</p>
    </div>
    {entryUnlocked&&<div className="notice stack"><strong>{template.influencerName} 채팅방에 입장할 수 있어요</strong><p>{room?`카드를 ${room.requiredCards}장 모아 채팅방이 열렸어요.`:'카드를 모아 채팅방이 열렸어요.'}</p><Link className="button no-underline self-start" href={room?`/chat/${room.roomId}`:'/chat'}>채팅방으로 가기</Link></div>}
    <div className="flex flex-wrap gap-2"><Link className="button secondary no-underline" href="/collection">컬렉션 보기</Link><Link className="button outline no-underline" href="/home">홈으로</Link></div>
  </div>;
}
export default function Draw(){return <Guard role="user"><DrawResult/></Guard>;}
