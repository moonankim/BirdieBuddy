'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Guard} from '@/components/chat/shell';
import {useChatApi} from '@/components/chat/api/chat-api';
import {CardArtwork,StatusPanel} from '@/components/ui/card-artwork';
import type {CompleteRoundData} from '@/lib/api/types';
import {gradeLabel,readLastDraw,styleLabel} from '../_lib/cards';

// 발급 결과(현호P D-06). 서버가 확정한 카드·등급·신규 여부·입장 가능을 보여 준다. 뽑기 연출은 미정(docs/design.md).
// 새 3등급 뽑기 연출 목업(/draw/preview) 진입점. 새 카드 SDK 연결 뒤 이 화면에 연출을 직접 적용하고 링크를 제거한다.
function PreviewLink(){return <Link className="bb-detail-caption inline-flex min-h-[44px] items-center self-center underline" href="/draw/preview">새 뽑기 연출 미리보기 (목업)</Link>;}

function DrawResult(){
  const api=useChatApi();
  const [result,setResult]=useState<CompleteRoundData|null|undefined>(undefined);
  const [roomId,setRoomId]=useState<string|null>(null);
  useEffect(()=>{setResult(readLastDraw());},[]);
  useEffect(()=>{
    if(!result?.entryUnlocked)return;let active=true;
    void api.getRooms().then(r=>{if(active&&r.ok)setRoomId(r.data.items.find(room=>room.influencerId===result.template.influencerId)?.roomId??null);});
    return()=>{active=false;};
  },[api,result]);
  if(result===undefined)return <StatusPanel tone="loading" title="결과를 확인하는 중이에요"/>;
  if(result===null)return <div className="stack"><StatusPanel tone="empty" title="아직 발급 결과가 없어요">홈에서 라운드 완료를 누르면 카드가 발급돼요.</StatusPanel><Link className="button secondary no-underline" href="/home">홈으로</Link><PreviewLink/></div>;
  const {template,grade,isNew,ownedCount,entryUnlocked}=result;
  return <div className="stack">
    <div><span className="eyebrow">ROUND COMPLETE</span><h1 className="page-title">카드가 도착했어요</h1></div>
    <div className="mx-auto w-full max-w-[240px]"><CardArtwork src={template.imageUrl} name={template.influencerName} grade={grade}/></div>
    <div className="card stack text-center">
      <p className="flex flex-wrap items-center justify-center gap-2"><strong className="text-[length:var(--type-heading)]">{template.influencerName}</strong><span className={isNew?'badge birdie':'badge gray'}>{isNew?'새 카드':'중복 카드'}</span></p>
      <p className="muted">{styleLabel[template.style]} · {gradeLabel[grade]} · 이 등급 {ownedCount}장 보유</p>
    </div>
    {entryUnlocked&&<div className="notice stack"><strong>{template.influencerName} 채팅방에 입장할 수 있어요</strong><p>카드를 5장 모아 채팅방이 열렸어요.</p><Link className="button no-underline self-start" href={roomId?`/chat/${roomId}`:'/chat'}>채팅방으로 가기</Link></div>}
    <div className="flex flex-wrap gap-2"><Link className="button secondary no-underline" href="/collection">컬렉션 보기</Link><Link className="button outline no-underline" href="/home">홈으로</Link></div>
    <PreviewLink/>
  </div>;
}
export default function Draw(){return <Guard role="user"><DrawResult/></Guard>;}
