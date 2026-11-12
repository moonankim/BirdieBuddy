'use client';
import Link from 'next/link';
import {CardArtwork,GradeBadge} from '@/components/ui/card-artwork';
import {cardCategoryLabels,cardLevelLabels,nextCardLevel,previewUpgradeCost,type CardPreview} from '@/lib/cards/presentation';

// 실제 SDK 연결 전의 UI 목업. 소유·인증 판정과 강화 요청은 수행하지 않는다.
export function CardDetail({card,returnToOwned=false}:{card:CardPreview;returnToOwned?:boolean}) {
  const nextLevel=nextCardLevel[card.grade];
  const previewCost=previewUpgradeCost;
  const missing=Math.max(0,previewCost-card.count);
  const backHref=returnToOwned?'/collection/owned':'/collection';
  const backLabel=returnToOwned?'보유 카드로':'컬렉션으로';
  return <div className="bb-detail">
    <Link className="bb-detail-back" href={backHref}>
      <svg className="bb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>{backLabel}
    </Link>
    <header className="bb-detail-heading">
      <div className="bb-detail-heading-meta"><span className="bb-detail-category">{cardCategoryLabels[card.category]}</span>{card.verifiedAt&&<span className="badge">인증됨</span>}</div>
      <h1 className="page-title">{card.name}</h1>
      <p className="bb-detail-caption">나의 카드 상세</p>
    </header>
    <figure className="bb-detail-showcase">
      <div className="bb-detail-art"><CardArtwork name={card.name}/></div>
      <figcaption>카드 이미지 준비 중</figcaption>
    </figure>
    <section className="bb-detail-info" aria-label="카드 정보">
      <div className="bb-detail-card-title"><h2>카드 정보</h2><GradeBadge grade={card.grade} label={cardLevelLabels[card.grade]}/></div>
      <dl className="bb-detail-facts">
        <div><dt>유형</dt><dd>{cardCategoryLabels[card.category]}</dd></div>
        <div><dt>등급</dt><dd>{cardLevelLabels[card.grade]}</dd></div>
        <div className="bb-detail-count"><dt>보유 장수</dt><dd>{card.count}<span>장</span></dd></div>
      </dl>
    </section>
    <section className="bb-detail-upgrade" aria-labelledby="upgrade-title">
      <h2 id="upgrade-title">{nextLevel?'다음 등급을 향해':'최고 등급 카드'}</h2>
      {nextLevel?<>
        <p>같은 카드 {previewCost}장을 모으면 <strong>{cardLevelLabels[nextLevel]}</strong> 카드로 강화할 수 있어요.</p>
        <div className="bb-detail-progress-label"><span>강화에 필요한 카드</span><strong>{card.count} / {previewCost}장</strong></div>
        <progress aria-label="강화 준비 수량" max={previewCost} value={Math.min(card.count,previewCost)}/>
        {missing>0?<button className="bb-button" type="button" disabled aria-describedby="upgrade-help">{missing}장 더 필요해요</button>:<Link className="bb-button" href={`/collection/upgrade?cardId=${encodeURIComponent(card.id)}&grade=${card.grade}${returnToOwned?'&from=owned':''}`} aria-describedby="upgrade-help">강화 미리보기</Link>}
        <p className="bb-detail-caption" id="upgrade-help">강화 화면을 미리 볼 수 있어요. 실제 카드는 사용하지 않아요.</p>
      </>:<p>LEGEND는 가장 높은 등급이에요. 더 이상 강화할 수 없어요.</p>}
    </section>
    <aside className="bb-detail-preview"><strong>목업 데이터</strong><p>보유 장수·유형·인증 여부는 화면 확인용 예시예요. 실제 계정의 보유 정보와 연결되지 않았고, 이미지는 공통 디폴트를 사용해요. 강화 비용 {previewCost}장도 시안 기준이에요.</p></aside>
  </div>;
}
