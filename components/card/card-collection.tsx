'use client';
import Link from 'next/link';
import {useState} from 'react';
import {CardArtwork,GradeBadge,StatusPanel} from '@/components/ui/card-artwork';
import {cardCategoryLabels,cardLevelLabels,previewUpgradeCost,type CardLevel,type CardPreview} from '@/lib/cards/presentation';
import {canPreviewUpgrade,cardLevels,cardFromTemplate,highestOwnedLevel,initialCardFilters,selectCollection,selectOwned,templateTotal,type CardFilters,type CollectionTemplate} from '@/lib/cards/collection';
import {mockCollectionTemplates} from '@/app/(user)/_mock/cards';

function cardHref(card:CardPreview,owned:boolean){return `/collection/${encodeURIComponent(card.id)}?grade=${card.grade}${owned?'&from=owned':''}`;}
function UpgradeLink({card,owned}:{card:CardPreview;owned:boolean}){
  if(!canPreviewUpgrade(card,previewUpgradeCost))return null;
  return <Link className="bb-button bb-button--secondary bb-collection-upgrade" href={`/collection/upgrade?cardId=${encodeURIComponent(card.id)}&grade=${card.grade}${owned?'&from=owned':''}`} aria-label={`${card.name} ${cardLevelLabels[card.grade]} 강화 미리보기`}>강화 가능 · {cardLevelLabels[card.grade]}</Link>;
}

// 렌더링 상태는 후속 조회 연결 시 외부에서 전달한다. 실패 시 목업으로 대체하지 않는다.
export function CardCollection({owned=false,templates=mockCollectionTemplates,status='ready',onRetry}:{owned?:boolean;templates?:CollectionTemplate[];status?:'ready'|'loading'|'error';onRetry?:()=>void}){
  const [filters,setFilters]=useState<CardFilters>(initialCardFilters);
  const update=<K extends keyof CardFilters>(key:K,value:CardFilters[K])=>setFilters(previous=>({...previous,[key]:value}));
  const collected=templates.filter(t=>templateTotal(t)>0).length;
  const totalOwned=templates.reduce((sum,t)=>sum+templateTotal(t),0);
  const all=selectCollection(templates,filters);
  const inventory=selectOwned(templates,filters);
  const hasFilters=filters.player!=='all'||filters.category!=='all'||filters.grade!=='all';
  const noResults=owned?inventory.length===0:all.length===0;
  return <div className="bb-album bb-stack">
    <header><h1 className="page-title">{owned?'보유 카드':'컬렉션'}</h1><p className="bb-detail-caption">{owned?'내가 가진 카드와 강화할 카드를 확인해요.':'모은 카드와 아직 만나지 못한 카드를 확인해요.'}</p></header>
    <aside className="bb-detail-preview"><strong>화면 확인용 예시</strong><p>아래 보유 수량·수집 현황·강화 조건은 모두 목업이에요. 실제 로그인 계정의 데이터가 아니며 카드 이미지는 공통 디폴트를 사용해요.</p></aside>
    <nav className="tabs bb-collection-tabs" aria-label="카드 보기"><Link className={`tab ${!owned?'active':''}`} href="/collection" aria-current={!owned?'page':undefined}>컬렉션</Link><Link className={`tab ${owned?'active':''}`} href="/collection/owned" aria-current={owned?'page':undefined}>보유 카드</Link></nav>
    {status==='loading'?<StatusPanel tone="loading" title="카드를 불러오고 있어요"><span className="bb-spinner" aria-hidden="true"/> 잠시 기다려 주세요.</StatusPanel>:status==='error'?<StatusPanel tone="error" title="카드를 불러오지 못했어요" onRetry={onRetry}>연결을 확인하고 다시 시도해 주세요.</StatusPanel>:<>
      <section className="bb-album-summary bb-collection-summary" aria-label="예시 카드 수집 현황"><p>{owned?'보유 카드 합계 (예시)':'수집한 카드 템플릿 (예시)'}</p><strong className="bb-album-count">{owned?`${totalOwned}장`:collected} {!owned&&<small>/ {templates.length}</small>}</strong>{!owned&&templates.length>0&&<progress aria-label="예시 카드 수집 현황" value={collected} max={templates.length}/>}</section>
      <div className="bb-collection-controls">
        <label>선수<select className="bb-field" value={filters.player} onChange={e=>update('player',e.target.value)}><option value="all">전체 선수</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>유형<select className="bb-field" value={filters.category} onChange={e=>update('category',e.target.value)}><option value="all">전체 유형</option>{Object.entries(cardCategoryLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>등급<select className="bb-field" value={filters.grade} onChange={e=>update('grade',e.target.value as 'all'|CardLevel)}><option value="all">전체 등급</option>{cardLevels.map(grade=><option key={grade} value={grade}>{cardLevelLabels[grade]}</option>)}</select></label>
        <label>정렬<select className="bb-field" value={filters.sort} onChange={e=>update('sort',e.target.value as CardFilters['sort'])}><option value="grade">등급 높은 순</option><option value="count">장수 많은 순</option></select></label>
      </div>
      {!owned&&filters.grade!=='all'&&<p className="bb-detail-caption">선택한 등급을 기준으로 카드를 보여줘요. 미보유 카드도 컬렉션에 남아 있어요.</p>}
      <div className="bb-collection-result-head"><h2>{owned?'보유 카드':'전체 카드'}</h2><span role="status">{owned?inventory.length:all.length}종{hasFilters&&' · 필터 적용'}</span>{hasFilters&&!noResults&&<button className="bb-button bb-button--secondary" type="button" onClick={()=>setFilters(initialCardFilters)}>필터 초기화</button>}</div>
      {templates.length===0?<StatusPanel tone="empty" title="등록된 카드가 없어요">카드 목록이 준비되면 여기에 표시돼요.</StatusPanel>:noResults?owned&&totalOwned===0?<section className="bb-state"><h2>아직 보유한 카드가 없어요</h2><p>라운드를 완료하고 첫 카드를 받아 보세요.</p><Link className="bb-button" href="/draw">라운드 완료</Link></section>:<StatusPanel tone="empty" title="조건에 맞는 카드가 없어요" onRetry={()=>setFilters(initialCardFilters)} retryLabel="필터 초기화">선수·유형·등급 조건을 바꿔 보세요.</StatusPanel>:<div className="bb-card-grid">
        {owned?inventory.map(card=><article className="card-tile" key={`${card.id}-${card.grade}`}><Link className="bb-card-detail-link" href={cardHref(card,true)} aria-label={`${card.name} ${cardLevelLabels[card.grade]} 카드 상세 보기`}><CardArtwork name={card.name}/><h3>{card.name}</h3><p>{cardCategoryLabels[card.category]}</p><GradeBadge grade={card.grade} label={cardLevelLabels[card.grade]}/><strong className="bb-collection-count">{card.count}장 보유 (예시)</strong><span className="bb-card-detail-hint">상세 보기</span></Link><UpgradeLink card={card} owned/></article>):all.map(template=>{
          const selected=filters.grade==='all'?highestOwnedLevel(template)??'basic':filters.grade;
          const card=cardFromTemplate(template,selected);
          const total=templateTotal(template);
          return <article className="card-tile" key={template.id}><Link className="bb-card-detail-link" href={cardHref(card,false)} aria-label={`${card.name} ${cardLevelLabels[selected]} 카드 상세 보기`}><CardArtwork name={card.name} unowned={card.count===0}/><h3>{card.name}</h3><p>{cardCategoryLabels[card.category]}</p><GradeBadge grade={selected} label={cardLevelLabels[selected]}/><strong className="bb-collection-count">{total>0?`총 ${total}장 보유 (예시)`:'미보유'}</strong></Link><dl className="bb-collection-levels">{cardLevels.map(grade=><div key={grade}><dt>{cardLevelLabels[grade]}</dt><dd><Link href={cardHref(cardFromTemplate(template,grade),false)} aria-label={`${template.name} ${cardLevelLabels[grade]} ${template.counts[grade]}장 상세 보기`}>{template.counts[grade]}장</Link></dd></div>)}</dl>{cardLevels.map(grade=><UpgradeLink key={grade} card={cardFromTemplate(template,grade)} owned={false}/>)}</article>;
        })}
      </div>}
    </>}
  </div>;
}
