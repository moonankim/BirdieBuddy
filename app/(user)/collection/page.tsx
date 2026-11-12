'use client';
import {useEffect,useState} from 'react';
import {Guard} from '@/components/chat/shell';
import {mockCards,TOTAL_TEMPLATES,type Grade} from '../_mock/cards';
import {CardArtwork,StatusPanel,type CardGrade} from '@/components/ui/card-artwork';
const gradeKeys:Record<Grade,CardGrade>={일반:'common',레어:'rare',에픽:'epic',스페셜:'special'};

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
    <p className="eyebrow mt-2">나의 카드 앨범</p>
    <h1 className="page-title mt-1">라운드로 채운 컬렉션</h1>
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
        <CardArtwork name={c.name} grade={gradeKeys[c.grade]}/>
        <h3>{c.name}</h3><p>{c.style}</p><strong>{c.count}장 보유</strong>
      </article>)}
      {showUnowned&&<article className="card-tile">
        <CardArtwork name="미보유" unowned/>
        <h3>미보유 카드</h3><p>아직 만나지 못했어요</p>
      </article>}
    </div>
    </div>
    {cards.length===0&&<StatusPanel tone="empty" title="조건에 맞는 카드가 없어요" onRetry={()=>setGrade('전체')} retryLabel="필터 초기화">필터를 바꿔 보세요.</StatusPanel>}
  </div>;
}
export default function CollectionPage(){return <Guard role="user"><Collection/></Guard>;}
