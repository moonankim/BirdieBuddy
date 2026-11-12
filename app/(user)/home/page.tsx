'use client';
import Link from 'next/link';
import type {ReactNode} from 'react';
import {Guard} from '@/components/chat/shell';
import {useSession} from '@/lib/session';
import {gradeBadge,mockCards} from '../_mock/cards';

// 샌드박스 목업 화면. design-system/sample/index.html 구성을 따른 가상 데이터이며,
// 실제 홈(라운드 정보·라운드 완료→발급 결과)은 현호P 화면으로 교체한다. 경로(/home 또는 /draw)는 현호P와 확정 예정.
const icon=(children:ReactNode,size?:number)=><svg className="icon" style={size?{width:size,height:size}:undefined} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{children}</svg>;
const cardIcon=icon(<><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 2h11a3 3 0 0 1 3 3v13M9 10h6M9 14h4"/></>);
const arrow=icon(<path d="M7 17 17 7M7 7h10v10"/>);
const MOCK_MONTH={rounds:1,target:3};

function Home(){
  const session=useSession();
  const nickname=session.status==='signedIn'?session.user.nickname:'버디';
  return <div>
    <p className="muted text-[length:var(--type-caption)]">반가워요, {nickname}님</p>
    <h1 className="page-title mt-1 mb-[18px]">오늘도 좋은 라운드!</h1>
    <div className="hero">
      <span className="eyebrow">YOUR NEXT ROUND</span>
      <h2>한 번의 라운드,<br/>새로운 만남.</h2>
      <p>라운드가 끝나면 카드가 찾아와요.</p>
      <Link className="button small light no-underline" href="/draw">라운드 완료 {arrow}</Link>
      <span className="golf-art" aria-hidden="true">{icon(<><path d="M8 21V3l11 4-11 5M4 21h12"/><ellipse cx="14" cy="20" rx="7" ry="2"/></>)}</span>
    </div>
    <div className="gauge">
      <div className="gauge-head"><span>이번 달 라운드</span><strong>{MOCK_MONTH.rounds} <small className="muted" style={{fontSize:'var(--type-caption)'}}>/ {MOCK_MONTH.target}회</small></strong></div>
      <div className="progress" role="progressbar" aria-label="이번 달 라운드" aria-valuenow={MOCK_MONTH.rounds} aria-valuemin={0} aria-valuemax={MOCK_MONTH.target}><span style={{width:`${MOCK_MONTH.rounds/MOCK_MONTH.target*100}%`}}/></div>
      <div className="gauge-foot"><span>채팅방 게이지 유지까지</span><strong>{MOCK_MONTH.target-MOCK_MONTH.rounds}회 남음</strong></div>
    </div>
    <div className="quick-row">
      <Link className="quick no-underline" href="/collection"><b>{cardIcon}</b>컬렉션</Link>
      <Link className="quick no-underline" href="/collection?tab=owned"><b>{cardIcon}</b>보유 카드</Link>
      <Link className="quick no-underline" href="/chat"><b>{icon(<><path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="M7 10h10M7 14h6"/></>)}</b>채팅</Link>
    </div>
    <div className="section-head"><h2 style={{fontSize:'var(--type-body)'}}>나의 카드</h2><Link href="/collection" className="no-underline">전체 보기 {arrow}</Link></div>
    <div className="card-grid">
      {mockCards.slice(0,2).map(c=><div key={c.id} className="card-tile">
        <div className={`card-picture ${c.art}`}><span className={gradeBadge[c.grade]}>{c.grade}</span><div className="portrait" aria-hidden="true"/></div>
        <h3>{c.name}</h3><p>{c.style} · {c.count}장</p>
      </div>)}
    </div>
  </div>;
}
export default function HomePage(){return <Guard role="user"><Home/></Guard>;}
