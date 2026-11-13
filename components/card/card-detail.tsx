'use client';
import Link from 'next/link';
import {CardArtwork,GradeBadge} from '@/components/ui/card-artwork';
import {cardCategoryLabels,cardLevelLabels,nextCardLevel,previewUpgradeCost,previewCardImageUrl,type CardLevel,type CardPreview} from '@/lib/cards/presentation';
import {cardLevels} from '@/lib/cards/collection';

function detailHref(id:string,grade:CardLevel,returnToOwned:boolean){return `/collection/${encodeURIComponent(id)}?grade=${grade}${returnToOwned?'&from=owned':''}`;}

// 실제 SDK 연결 전의 UI 목업. 소유·인증 판정과 강화 요청은 수행하지 않는다.
// counts는 같은 카드의 등급별 수량이며, 전달된 경우에만 등급 전환을 표시한다.
export function CardDetail({card,counts,returnToOwned=false}:{card:CardPreview;counts?:Record<CardLevel,number>;returnToOwned?:boolean}) {
  const nextLevel=nextCardLevel[card.grade];
  const previewCost=previewUpgradeCost;
  const missing=Math.max(0,previewCost-card.count);
  const owned=card.count>0;
  const backHref=returnToOwned?'/collection/owned':'/collection';
  const backLabel=returnToOwned?'보유 카드로':'컬렉션으로';
  return <div className="bb-detail">
    <Link className="bb-detail-back" href={backHref}>
      <svg className="bb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>{backLabel}
    </Link>
    <header className="bb-detail-heading">
      <p className="bb-eyebrow bb-eyebrow--start" aria-hidden="true">Affiliation</p>
      <div className="bb-detail-heading-meta"><span className="bb-tag" data-grade={card.grade}>{cardCategoryLabels[card.category]}</span>{card.verifiedAt&&<span className="badge">인증됨</span>}</div>
      <h1 className="page-title bb-poster-title">{card.name}</h1>
      <p className="bb-detail-caption">{owned?'나의 카드 상세':'아직 보유하지 않은 등급이에요'}</p>
    </header>
    {counts&&<section className="bb-detail-levels"><p className="bb-eyebrow" aria-hidden="true">Level</p><nav className="bb-level-track" aria-label="등급 선택">{cardLevels.map(grade=>counts[grade]>0||grade===card.grade?<Link key={grade} className="bb-level" data-grade={grade} href={detailHref(card.id,grade,returnToOwned)} aria-current={grade===card.grade?'page':undefined} aria-label={`${cardLevelLabels[grade]} ${counts[grade]>0?`${counts[grade]}장 보유`:'미보유'}`}><span className="bb-level-tag">{cardLevelLabels[grade]}</span><small>{counts[grade]>0?`${counts[grade]}장`:'미보유'}</small></Link>:<span key={grade} className="bb-level" data-grade={grade} data-owned="false" aria-label={`${cardLevelLabels[grade]} 미보유`}><span className="bb-level-tag">{cardLevelLabels[grade]}</span><small>미보유</small></span>)}</nav></section>}
    <figure className="bb-detail-showcase bb-band" data-level={card.grade}>
      <div className="bb-detail-art"><CardArtwork src={previewCardImageUrl} name={card.name} unowned={!owned}/></div>
      <figcaption>{owned?'공통 예시 이미지예요. 선수별 카드 아트는 연결 후 표시돼요.':`${cardLevelLabels[card.grade]} 카드를 아직 만나지 못했어요`}</figcaption>
    </figure>
    <section className="bb-detail-info" aria-label="카드 정보">
      <div className="bb-detail-card-title"><h2>카드 정보</h2><GradeBadge grade={card.grade} label={cardLevelLabels[card.grade]}/></div>
      <dl className="bb-detail-facts">
        <div><dt>유형</dt><dd>{cardCategoryLabels[card.category]}</dd></div>
        <div><dt>등급</dt><dd>{cardLevelLabels[card.grade]}</dd></div>
        <div className="bb-detail-count"><dt>보유 장수</dt><dd>{card.count}<span>장</span>{!owned&&<span>· 미보유</span>}</dd></div>
      </dl>
    </section>
    <section className="bb-detail-upgrade" aria-labelledby="upgrade-title">
      <h2 id="upgrade-title">{nextLevel?'다음 등급을 향해':'최고 등급 카드'}</h2>
      {nextLevel?<>
        <p>같은 카드 {previewCost}장을 모으면 <strong>{cardLevelLabels[nextLevel]}</strong> 카드로 강화할 수 있어요.</p>
        <div className="bb-detail-progress-label"><span>강화에 필요한 카드</span><strong>{card.count} / {previewCost}장</strong></div>
        <progress aria-label="강화 준비 수량" max={previewCost} value={Math.min(card.count,previewCost)}/>
        {missing>0?<button className="bb-button" type="button" disabled aria-describedby="upgrade-help">{missing}장 더 필요해요</button>:<Link className="bb-button" href={`/collection/upgrade?cardId=${encodeURIComponent(card.id)}&grade=${card.grade}${returnToOwned?'&from=owned':''}`} aria-describedby="upgrade-help">강화 미리보기</Link>}
        <p className="bb-detail-caption" id="upgrade-help">{missing>0?'라운드를 완료해 같은 카드를 더 모아 보세요. ':''}강화 화면을 미리 볼 수 있어요. 실제 카드는 사용하지 않아요.</p>
      </>:<p>LEGEND는 가장 높은 등급이에요. 더 이상 강화할 수 없어요.</p>}
    </section>
    <aside className="bb-detail-preview"><strong>목업 데이터</strong><p>보유 장수·유형·인증 여부는 화면 확인용 예시예요. 실제 계정의 보유 정보와 연결되지 않았고, 이미지는 공통 디폴트를 사용해요. 강화 비용 {previewCost}장도 시안 기준이에요.</p></aside>
  </div>;
}
