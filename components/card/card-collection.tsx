'use client';
import Link from 'next/link';
import {useState} from 'react';
import {CardArtwork,GradeBadge,StatusPanel} from '@/components/ui/card-artwork';
import {cardCategoryLabels,cardLevelLabels,previewUpgradeCost,previewCardImageUrl,type CardCategory,type CardLevel,type CardPreview} from '@/lib/cards/presentation';
import {canPreviewUpgrade,cardLevels,initialCardFilters,selectOwned,templateTotal,type CardFilters,type CollectionTemplate} from '@/lib/cards/collection';
import {mockCollectionTemplates} from '@/app/(user)/_mock/cards';
import {CardTabs,ChipGroup,Segmented,type ChipOption} from './card-controls';

export const gradeChipOptions:ChipOption<'all'|CardLevel>[]=[{value:'all',label:'전체'},...cardLevels.map(grade=>({value:grade,label:cardLevelLabels[grade],grade}))];
export const categoryChipOptions:ChipOption<'all'|CardCategory>[]=[{value:'all',label:'전체'},...(Object.entries(cardCategoryLabels) as [CardCategory,string][]).map(([value,label])=>({value,label}))];
const sortOptions:ChipOption<CardFilters['sort']>[]=[{value:'grade',label:'등급순'},{value:'count',label:'장수순'}];

function cardHref(card:CardPreview){return `/collection/${encodeURIComponent(card.id)}?grade=${card.grade}&from=owned`;}
function UpgradeLink({card}:{card:CardPreview}){
  if(!canPreviewUpgrade(card,previewUpgradeCost))return null;
  return <Link className="bb-button bb-button--secondary bb-collection-upgrade" href={`/collection/upgrade?cardId=${encodeURIComponent(card.id)}&grade=${card.grade}&from=owned`} aria-label={`${card.name} ${cardLevelLabels[card.grade]} 강화 미리보기`}>강화 가능 · {cardLevelLabels[card.grade]}</Link>;
}

// 보유 카드(/collection/owned). 실제 연결 시 보유 조회 결과를 templates·status로 전달하며 실패를 목업으로 대체하지 않는다.
export function CardCollection({templates=mockCollectionTemplates,status='ready',onRetry}:{templates?:CollectionTemplate[];status?:'ready'|'loading'|'error';onRetry?:()=>void}){
  const [filters,setFilters]=useState<CardFilters>(initialCardFilters);
  const update=<K extends keyof CardFilters>(key:K,value:CardFilters[K])=>setFilters(previous=>({...previous,[key]:value}));
  const totalOwned=templates.reduce((sum,t)=>sum+templateTotal(t),0);
  const ownedKinds=selectOwned(templates,initialCardFilters).length;
  const inventory=selectOwned(templates,filters);
  const hasFilters=filters.player!=='all'||filters.category!=='all'||filters.grade!=='all';
  const ownedPlayers=templates.filter(t=>templateTotal(t)>0);
  return <div className="bb-album bb-stack">
    <header><p className="bb-eyebrow bb-eyebrow--start" aria-hidden="true">My cards</p><h1 className="page-title bb-poster-title">보유 카드</h1><p className="bb-detail-caption">내가 가진 카드와 강화할 카드를 확인해요.</p></header>
    <aside className="bb-detail-preview"><strong>화면 확인용 예시</strong><p>보유 수량·강화 조건은 목업이에요. 실제 로그인 계정의 데이터가 아니며 카드 이미지는 공통 디폴트를 사용해요.</p></aside>
    <CardTabs current="owned"/>
    {status==='loading'?<StatusPanel tone="loading" title="카드를 불러오고 있어요"><span className="bb-spinner" aria-hidden="true"/> 잠시 기다려 주세요.</StatusPanel>:status==='error'?<StatusPanel tone="error" title="카드를 불러오지 못했어요" onRetry={onRetry}>연결을 확인하고 다시 시도해 주세요.</StatusPanel>:totalOwned===0?<section className="bb-state"><h2>아직 보유한 카드가 없어요</h2><p>라운드를 완료하고 첫 카드를 받아 보세요.</p><Link className="bb-button" href="/draw">라운드 완료</Link></section>:<>
      <section className="bb-stat" aria-label="보유 현황 (예시)">
        <p className="bb-stat-label">보유 카드 (예시)</p>
        <p className="bb-stat-value">{totalOwned}<small>장</small></p>
        <p className="bb-stat-sub">{ownedKinds}종 보유</p>
        <ul className="bb-stat-grades" aria-label="등급별 보유 장수">{cardLevels.map(grade=><li key={grade} data-grade={grade}><span className="bb-badge" data-grade={grade}>{cardLevelLabels[grade]}</span>{templates.reduce((sum,t)=>sum+t.counts[grade],0)}장</li>)}</ul>
      </section>
      <div className="bb-filter-bar">
        <ChipGroup label="등급" value={filters.grade} options={gradeChipOptions} onChange={value=>update('grade',value)}/>
        <ChipGroup label="유형" value={filters.category as 'all'|CardCategory} options={categoryChipOptions} onChange={value=>update('category',value)}/>
        <label className="bb-filter-select">선수<select className="bb-field" value={filters.player} onChange={e=>update('player',e.target.value)}><option value="all">전체 선수</option>{ownedPlayers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <div className="bb-collection-result-head"><h2>보유 카드</h2><span role="status">{inventory.length}종{hasFilters&&' · 필터 적용'}</span><Segmented label="정렬" value={filters.sort} options={sortOptions} onChange={value=>update('sort',value)}/></div>
      {inventory.length===0?<StatusPanel tone="empty" title="조건에 맞는 카드가 없어요" onRetry={()=>setFilters(previous=>({...initialCardFilters,sort:previous.sort}))} retryLabel="필터 초기화">등급·유형·선수 조건을 바꿔 보세요.</StatusPanel>:<div className="bb-card-grid">
        {inventory.map(card=><article className="card-tile" key={`${card.id}-${card.grade}`}><Link className="bb-card-detail-link" href={cardHref(card)} aria-label={`${card.name} ${cardLevelLabels[card.grade]} 카드 상세 보기`}><CardArtwork src={previewCardImageUrl} name={card.name}/><h3>{card.name}</h3><p>{cardCategoryLabels[card.category]}</p><GradeBadge grade={card.grade} label={cardLevelLabels[card.grade]}/><strong className="bb-collection-count">{card.count}장 보유 (예시)</strong></Link><UpgradeLink card={card}/></article>)}
      </div>}
    </>}
  </div>;
}
