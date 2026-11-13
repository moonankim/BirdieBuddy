'use client';
import Link from 'next/link';
import {useState} from 'react';
import {CardArtwork,GradeBadge,StatusPanel} from '@/components/ui/card-artwork';
import {cardCategoryLabels,cardLevelLabels,type CardCategory} from '@/lib/cards/presentation';
import {cardLevels,initialCatalogFilters,ownedLevelCount,selectCatalog,templateTotal,type CatalogFilters,type CollectionTemplate} from '@/lib/cards/collection';
import {mockCollectionTemplates} from '@/app/(user)/_mock/cards';
import {CardTabs,ChipGroup} from './card-controls';
import {categoryChipOptions,gradeChipOptions} from './card-collection';

// 컬렉션(/collection): 정적 카드 목록(CDN manifest)을 전시하는 도감. 카드 목록은 API와 무관하다.
// 보유 표시(counts)만 덧입히며, 실제 연결 시 보유 조회 결과를 넣는다. 조회 실패 시에도 목록은 보여 주고 보유 표시만 숨긴다.
export function CardCatalog({templates=mockCollectionTemplates,ownership='ready',onRetryOwnership}:{templates?:CollectionTemplate[];ownership?:'ready'|'loading'|'error';onRetryOwnership?:()=>void}){
  const [filters,setFilters]=useState<CatalogFilters>(initialCatalogFilters);
  const cards=selectCatalog(templates,filters);
  const showOwnership=ownership==='ready';
  const totalCards=templates.length*cardLevels.length;
  const collectedCards=cardLevels.reduce((sum,grade)=>sum+ownedLevelCount(templates,grade),0);
  const collectedPlayers=templates.filter(t=>templateTotal(t)>0).length;
  return <div className="bb-album bb-stack">
    <header><p className="bb-eyebrow bb-eyebrow--start" aria-hidden="true">Collection</p><h1 className="page-title bb-poster-title">컬렉션</h1><p className="bb-detail-caption">버디버디의 모든 카드를 모아 봐요. 아직 없는 카드는 흑백으로 보여요.</p></header>
    <aside className="bb-detail-preview"><strong>카드 목록은 정적 데이터예요</strong><p>카드 이미지와 목록은 등록된 카드 이미지 목록을 사용해요. 보유 표시는 화면 확인용 예시예요.</p></aside>
    <CardTabs current="catalog"/>
    {templates.length===0?<StatusPanel tone="empty" title="등록된 카드가 없어요">카드 목록이 준비되면 여기에 표시돼요.</StatusPanel>:<>
      {ownership==='loading'?<StatusPanel tone="loading" title="보유 현황을 확인하고 있어요"/>:ownership==='error'?<StatusPanel tone="error" title="보유 현황을 불러오지 못했어요" onRetry={onRetryOwnership}>카드 목록은 그대로 볼 수 있어요.</StatusPanel>:<section className="bb-stat" aria-label="수집 현황 (예시)">
        <p className="bb-stat-label">모은 카드 (예시)</p>
        <p className="bb-stat-value">{collectedCards}<small>/ {totalCards}</small></p>
        <p className="bb-stat-sub">선수 {collectedPlayers} / {templates.length}명</p>
        <progress className="bb-stat-progress" aria-label="카드 수집 현황" value={collectedCards} max={totalCards}/>
        <ul className="bb-stat-grades" aria-label="등급별 수집 현황">{cardLevels.map(grade=><li key={grade} data-grade={grade}><span className="bb-badge" data-grade={grade}>{cardLevelLabels[grade]}</span>{ownedLevelCount(templates,grade)} / {templates.length}</li>)}</ul>
      </section>}
      {showOwnership&&collectedCards===0&&<section className="bb-state" data-tone="info" aria-labelledby="collection-empty-title"><strong id="collection-empty-title">아직 모은 카드가 없어요</strong><p>라운드를 완료하면 카드 1장을 받아요. 아래에서 모을 수 있는 카드를 미리 확인해 보세요.</p><Link className="bb-button" href="/home">홈에서 라운드 완료하기</Link></section>}
      <div className="bb-filter-bar">
        <ChipGroup label="등급" value={filters.grade} options={gradeChipOptions} onChange={grade=>setFilters(previous=>({...previous,grade}))}/>
        <ChipGroup label="유형" value={filters.category as 'all'|CardCategory} options={categoryChipOptions} onChange={category=>setFilters(previous=>({...previous,category}))}/>
      </div>
      <div className="bb-collection-result-head"><h2>전체 카드</h2><span role="status">{cards.length}장</span></div>
      {cards.length===0?<StatusPanel tone="empty" title="조건에 맞는 카드가 없어요" onRetry={()=>setFilters(initialCatalogFilters)} retryLabel="필터 초기화">등급·유형 조건을 바꿔 보세요.</StatusPanel>:<div className="bb-card-grid">
        {cards.map(card=>{
          const owned=card.count>0;
          return <article className="card-tile" key={`${card.id}-${card.grade}`}><Link className="bb-card-detail-link" href={`/collection/${encodeURIComponent(card.id)}?grade=${card.grade}`} aria-label={`${card.name} ${cardLevelLabels[card.grade]} 카드 상세 보기`}><CardArtwork src={card.imageUrl} name={`${card.name} ${cardLevelLabels[card.grade]}`} locked={showOwnership&&!owned}/><h3>{card.name}</h3><p>{cardCategoryLabels[card.category]}</p><GradeBadge grade={card.grade} label={cardLevelLabels[card.grade]}/>{showOwnership&&<strong className="bb-collection-count">{owned?`${card.count}장 보유 (예시)`:'미보유'}</strong>}</Link></article>;
        })}
      </div>}
    </>}
  </div>;
}
