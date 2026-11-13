'use client';
import Link from 'next/link';
import Image from 'next/image';
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

// 홈. 화면 구성은 현호P 디자인(카드 미리보기 영역), 데이터는 실제 SDK:
// 이번 달 라운드(getMyRoundGaugeSummary), 라운드 완료(completeRound → /draw), 나의 카드(getOwnedCards).
// 카드 목록·상세·강화(/collection/**)는 새 카드 규격(3등급) 목업이며 백엔드 규격 이관 뒤 연결한다(docs/card-ui-handoff.md).
const icon=(children:ReactNode,size?:number)=><svg className="icon" style={size?{width:size,height:size}:undefined} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{children}</svg>;
const cardIcon=icon(<><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 2h11a3 3 0 0 1 3 3v13M9 10h6M9 14h4"/></>);
const arrow=icon(<path d="M7 17 17 7M7 7h10v10"/>);

function Home(){
  const api=useChatApi();const router=useRouter();const session=useSession();
  const user=session.status==='signedIn'?session.user:null;const nickname=user?.nickname??'버디';
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
  const done=(r:Awaited<ReturnType<typeof round.run>>)=>{if(r.ok&&user){saveLastDraw(user.userId,r.data);router.push('/draw');}};
  // 응답을 못 받은 재시도 가능 오류 동안에는 서버가 이미 발급했을 수 있으므로, 기본 버튼도 같은 요청(같은 요청 ID)으로만 다시 보낸다.
  const retrying=!!round.error?.retryable;
  const submit=async()=>done(await (retrying?round.retry():round.run({})));
  const rounds=summary?.monthlyRoundCount??0;const target=summary?.targetRounds??3;

  return <div className="bb-home">
    <p className="muted text-[length:var(--type-caption)]">반가워요, {nickname}님</p>
    <h1 className="page-title mt-1 mb-[18px]">오늘도 좋은 라운드!</h1>
    <section className="bb-feature" aria-label="카드 디자인 미리보기">
      <div className="bb-feature-copy">
        <span className="bb-feature-label">라운드에서 컬렉션으로</span>
        <h2>나의 라운드가<br/>한 장의 카드로.</h2>
        <p>좋아하는 선수와 함께<br/>컬렉션을 채워 보세요.</p>
        <Link className="bb-feature-link" href="/collection">컬렉션 보기</Link>
      </div>
      <figure>
        <Link className="bb-feature-art" href="/collection" aria-label="공태풍 카드 디자인과 컬렉션 보기"><Image src="/cards/gong-tae-pung-basic.png" alt="공태풍 G투어 카드 디자인 미리보기" width={1024} height={1536} sizes="(max-width: 359px) 200px, 220px" priority/></Link>
        <figcaption>공태풍 · 디자인 미리보기</figcaption>
      </figure>
    </section>
    <button type="button" className="bb-button mt-4 w-full" disabled={round.pending} aria-busy={round.pending} onClick={submit}>{round.pending?'카드 발급 중...':retrying?<>발급 다시 시도 {arrow}</>:<>라운드 완료 {arrow}</>}</button>
    {round.error&&<p role="alert" className="notice error mt-3">{errorText(round.error.code,round.error.details)} <RetryButton error={round.error} pending={round.pending} onRetry={async()=>done(await round.retry())}/></p>}
    <div className="gauge">
      <div className="gauge-head"><span>이번 달 라운드</span><strong>{summary?rounds:'-'} <small className="muted" style={{fontSize:'var(--type-caption)'}}>/ {target}회</small></strong></div>
      <div className="progress" role="progressbar" aria-label="이번 달 라운드" aria-valuenow={rounds} aria-valuemin={0} aria-valuemax={target}><span style={{width:`${Math.min(100,rounds/target*100)}%`}}/></div>
      <div className="gauge-foot"><span>채팅방 게이지 유지까지</span><strong>{summary?(summary.remainingRounds>0?`${summary.remainingRounds}회 남음`:'이번 달 달성'):'불러오는 중'}</strong></div>
    </div>
    <div className="quick-row">
      <Link className="quick no-underline" href="/collection"><b>{cardIcon}</b>컬렉션</Link>
      <Link className="quick no-underline" href="/collection/owned"><b>{cardIcon}</b>보유 카드</Link>
      <Link className="quick no-underline" href="/chat"><b>{icon(<><path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M7 10h10M7 14h6"/></>)}</b>채팅</Link>
    </div>
    <div className="section-head"><h2>나의 카드</h2></div>
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
