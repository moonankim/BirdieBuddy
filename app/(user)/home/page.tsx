'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {Guard} from '@/components/chat/shell';
import {useChatApi} from '@/components/chat/api/chat-api';
import {useRequest} from '@/components/chat/hooks/use-request';
import {RetryButton} from '@/components/chat/retry-button';
import {errorText} from '@/components/chat/copy';
import {CardArtwork,StatusPanel} from '@/components/ui/card-artwork';
import {useSession} from '@/lib/session';
import type {CompleteRoundData,OwnedCardItem,RoundGaugeSummary} from '@/lib/api/types';
import {byBestCard,saveLastDraw,styleLabel} from '../_lib/cards';

// 홈: 이번 달 라운드(getMyRoundGaugeSummary), 나의 카드(getOwnedCards), 라운드 완료(completeRound → /draw).
// 화면 디자인은 design-system/sample/index.html 구성을 따른다. 경로(/home 또는 /draw)는 현호P와 확정 예정.
const icon=(children:ReactNode,size?:number)=><svg className="icon" style={size?{width:size,height:size}:undefined} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{children}</svg>;
const cardIcon=icon(<><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 2h11a3 3 0 0 1 3 3v13M9 10h6M9 14h4"/></>);
const arrow=icon(<path d="M7 17 17 7M7 7h10v10"/>);

function Home(){
  const api=useChatApi();const router=useRouter();const session=useSession();
  const nickname=session.status==='signedIn'?session.user.nickname:'버디';
  const [summary,setSummary]=useState<RoundGaugeSummary|null>(null);
  const [cards,setCards]=useState<OwnedCardItem[]|null>(null);
  const [loadFailed,setLoadFailed]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;setLoadFailed(false);
    void Promise.all([api.getMyRoundGaugeSummary(),api.getOwnedCards()]).then(([month,owned])=>{
      if(!active)return;
      if(month.ok)setSummary(month.data);
      if(owned.ok)setCards([...owned.data.items].sort(byBestCard));
      if(!month.ok||!owned.ok)setLoadFailed(true);
    }).catch(()=>{if(active)setLoadFailed(true);});
    return()=>{active=false;};
  },[api,revision]);
  const complete=useCallback((input:{requestId:string})=>api.completeRound(input),[api]);
  const round=useRequest<Record<string,never>,CompleteRoundData>(complete);
  const done=(r:Awaited<ReturnType<typeof round.run>>)=>{if(r.ok){saveLastDraw(r.data);router.push('/draw');}};
  const rounds=summary?.monthlyRoundCount??0;const target=summary?.targetRounds??3;

  return <div>
    <p className="muted text-[length:var(--type-caption)]">반가워요, {nickname}님</p>
    <h1 className="page-title mt-1 mb-[18px]">오늘도 좋은 라운드!</h1>
    <div className="hero">
      <span className="eyebrow">YOUR NEXT ROUND</span>
      <h2>한 번의 라운드,<br/>새로운 만남.</h2>
      <p>라운드가 끝나면 카드가 찾아와요.</p>
      <button type="button" className="button small light" disabled={round.pending} aria-busy={round.pending} onClick={async()=>done(await round.run({}))}>{round.pending?'카드 발급 중...':<>라운드 완료 {arrow}</>}</button>
      <span className="golf-art" aria-hidden="true">{icon(<><path d="M8 21V3l11 4-11 5M4 21h12"/><ellipse cx="14" cy="20" rx="7" ry="2"/></>)}</span>
    </div>
    {round.error&&<p role="alert" className="notice error mt-3">{errorText(round.error.code,round.error.details)} <RetryButton error={round.error} pending={round.pending} onRetry={async()=>done(await round.retry())}/></p>}
    <div className="gauge">
      <div className="gauge-head"><span>이번 달 라운드</span><strong>{summary?rounds:'-'} <small className="muted" style={{fontSize:'var(--type-caption)'}}>/ {target}회</small></strong></div>
      <div className="progress" role="progressbar" aria-label="이번 달 라운드" aria-valuenow={rounds} aria-valuemin={0} aria-valuemax={target}><span style={{width:`${Math.min(100,rounds/target*100)}%`}}/></div>
      <div className="gauge-foot"><span>채팅방 게이지 유지까지</span><strong>{summary?(summary.remainingRounds>0?`${summary.remainingRounds}회 남음`:'이번 달 달성'):'불러오는 중'}</strong></div>
    </div>
    <div className="quick-row">
      <Link className="quick no-underline" href="/collection"><b>{cardIcon}</b>컬렉션</Link>
      <Link className="quick no-underline" href="/collection?tab=owned"><b>{cardIcon}</b>보유 카드</Link>
      <Link className="quick no-underline" href="/chat"><b>{icon(<><path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M7 10h10M7 14h6"/></>)}</b>채팅</Link>
    </div>
    <div className="section-head"><h2 style={{fontSize:'var(--type-body)'}}>나의 카드</h2><Link href="/collection?tab=owned" className="no-underline">전체 보기 {arrow}</Link></div>
    {loadFailed&&<StatusPanel tone="error" title="정보를 불러오지 못했어요" onRetry={()=>setRevision(v=>v+1)}>잠시 후 다시 시도해 주세요.</StatusPanel>}
    {cards===null&&!loadFailed?<StatusPanel tone="loading" title="카드를 불러오는 중이에요"/>
      :cards?.length===0?<StatusPanel tone="empty" title="아직 보유한 카드가 없어요">라운드를 마치면 카드가 찾아와요.</StatusPanel>
      :<div className="card-grid">{cards?.slice(0,2).map(c=><div key={`${c.template.id}:${c.grade}`} className="card-tile">
          <CardArtwork src={c.template.imageUrl} name={c.template.influencerName} grade={c.grade}/>
          <h3>{c.template.influencerName}</h3><p>{styleLabel[c.template.style]} · {c.count}장</p>
        </div>)}</div>}
  </div>;
}
export default function HomePage(){return <Guard role="user"><Home/></Guard>;}
