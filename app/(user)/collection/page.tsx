'use client';
import {useEffect,useState} from 'react';
import {Guard} from '@/components/chat/shell';
import {gradeBadge,mockCards,TOTAL_TEMPLATES,type Grade} from '../_mock/cards';

// 샌드박스 목업 화면. design-system/sample/collection.html 구성을 따른 가상 데이터이며,
// 실제 컬렉션·보유 카드·강화는 현호P 화면(app/(user)/collection/**)으로 교체한다.
const grades:('전체'|Grade)[]=['전체','일반','레어','에픽','스페셜'];

function Collection(){
  const [tab,setTab]=useState<'all'|'owned'>('all');
  const [grade,setGrade]=useState<'전체'|Grade>('전체');
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('tab')==='owned')setTab('owned');},[]);
  const cards=mockCards.filter(c=>grade==='전체'||c.grade===grade);
  const showUnowned=tab==='all'&&grade==='전체';
  return <div>
    <p className="eyebrow mt-2">MY COLLECTION</p>
    <h1 className="page-title mt-1">차곡차곡, 나의 버디</h1>
    <div className="statline mt-4 mb-2 flex justify-between text-[length:var(--type-caption)] text-[var(--text-secondary)]">수집한 카드 템플릿 <strong className="text-[var(--text-accent)]">{mockCards.length} / {TOTAL_TEMPLATES}</strong></div>
    <div className="progress" role="progressbar" aria-label="카드 템플릿 수집 현황" aria-valuenow={mockCards.length} aria-valuemin={0} aria-valuemax={TOTAL_TEMPLATES}><span style={{width:`${mockCards.length/TOTAL_TEMPLATES*100}%`}}/></div>
    <div className="tabs" aria-label="카드 보기">
      <button className={`tab ${tab==='all'?'active':''}`} type="button" aria-pressed={tab==='all'} onClick={()=>setTab('all')}>컬렉션</button>
      <button className={`tab ${tab==='owned'?'active':''}`} type="button" aria-pressed={tab==='owned'} onClick={()=>setTab('owned')}>보유 카드</button>
    </div>
    <div className="filters" aria-label="등급 필터">
      {grades.map(g=><button key={g} className={`filter ${grade===g?'active':''}`} type="button" aria-pressed={grade===g} onClick={()=>setGrade(g)}>{g}</button>)}
    </div>
    <div className="section-mini"><div className="section-head"><h2>{tab==='all'?'나의 컬렉션':'보유 카드'}</h2><span>가상 데이터</span></div>
    <div className="card-grid">
      {cards.map(c=><article key={c.id} className="card-tile">
        <div className={`card-picture ${c.art}`}><span className={gradeBadge[c.grade]}>{c.grade}</span><div className="portrait" aria-hidden="true"/></div>
        <h3>{c.name}</h3><p>{c.style}</p><strong>{c.count}장 보유</strong>
      </article>)}
      {showUnowned&&<article className="card-tile">
        <div className="card-picture empty"><span style={{fontSize:40,marginBottom:48}} aria-hidden="true">?</span></div>
        <h3>미보유 카드</h3><p>아직 만나지 못했어요</p>
      </article>}
    </div>
    </div>
    {cards.length===0&&<p className="muted mt-3 text-[length:var(--type-caption)]">조건에 맞는 카드가 없어요. 필터를 바꿔 보세요.</p>}
  </div>;
}
export default function CollectionPage(){return <Guard role="user"><Collection/></Guard>;}
