'use client';
import Link from 'next/link';
import {useEffect,useId,useRef,useState} from 'react';
import {CardArtwork,GradeBadge} from '@/components/ui/card-artwork';
import {cardCategoryLabels,cardLevelLabels,nextCardLevel,previewUpgradeCost,type CardLevel,type CardPreview} from '@/lib/cards/presentation';

// 강화의 화면 흐름만 확인한다. 서버 요청·카드 수량 변경·저장은 수행하지 않는다.
export function CardUpgrade({card,returnToOwned=false}:{card:CardPreview;returnToOwned?:boolean}) {
  const [confirmed,setConfirmed]=useState(false);
  const [result,setResult]=useState<{grade:CardLevel;remaining:number}|null>(null);
  const confirmationId=useId();
  const resultHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(result)resultHeading.current?.focus();},[result]);
  const nextLevel=nextCardLevel[card.grade];
  const cost=previewUpgradeCost;
  const missing=Math.max(0,cost-card.count);
  const eligible=nextLevel!==null&&missing===0;
  const detailHref=`/collection/${encodeURIComponent(card.id)}?grade=${card.grade}${returnToOwned?'&from=owned':''}`;
  const collectionHref=returnToOwned?'/collection/owned':'/collection';
  const showResult=()=>{
    if(!confirmed||!nextLevel||missing>0||result)return;
    setResult({grade:nextLevel,remaining:card.count-cost});
  };
  return <div className="bb-detail">
    <Link className="bb-detail-back" href={detailHref}>
      <svg className="bb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>카드 상세로
    </Link>
    <header className="bb-detail-heading">
      <span className="bb-detail-category">{cardCategoryLabels[card.category]} · {card.name}</span>
      <h1 className="page-title" ref={resultHeading} tabIndex={-1}>{result?'강화 결과 미리보기':'카드 강화'}</h1>
      <p className="bb-detail-caption">{result?'모은 카드가 다음 등급으로.':'사용할 카드와 받을 카드를 확인해 주세요.'}</p>
    </header>
    <aside className="bb-detail-preview"><strong>목업 미리보기</strong><p>디폴트 카드로 구성한 화면이에요. 실제 카드·보유 장수·계정 정보는 바뀌지 않고, 돌아가거나 새로고침하면 미리보기 결과는 초기화돼요.</p></aside>
    {result?<>
      <figure className="bb-detail-showcase bb-upgrade-result">
        <GradeBadge grade={result.grade} label={cardLevelLabels[result.grade]}/>
        <div className="bb-detail-art"><CardArtwork name={card.name}/></div>
        <figcaption>{card.name} · {cardLevelLabels[result.grade]} 카드 1장 획득 예시</figcaption>
      </figure>
      <section className="bb-detail-info" aria-label="강화 결과 수량">
        <h2>미리보기 결과</h2>
        <dl className="bb-upgrade-quantities">
          <div><dt>사용한 {cardLevelLabels[card.grade]} 카드</dt><dd>{cost}장</dd></div>
          <div><dt>받은 {cardLevelLabels[result.grade]} 카드</dt><dd>1장</dd></div>
          <div><dt>남은 {cardLevelLabels[card.grade]} 카드</dt><dd>{result.remaining}장</dd></div>
        </dl>
        <p className="bb-detail-caption">실제 보유 수량이 아닌 이 화면의 계산 예시예요.</p>
      </section>
      <div className="bb-upgrade-actions"><Link className="bb-button" href={collectionHref}>컬렉션으로</Link><Link className="bb-button bb-button--secondary" href={detailHref}>카드 상세로 돌아가기</Link></div>
    </>:<>
      <section className="bb-detail-info" aria-label="강화 전후 카드">
        <div className="bb-upgrade-pair">
          <figure><CardArtwork name={`${card.name} 현재 등급`}/><figcaption><GradeBadge grade={card.grade} label={cardLevelLabels[card.grade]}/><span>{nextLevel?`사용 카드 ${cost}장`:'현재 카드'}</span></figcaption></figure>
          <svg className="bb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>
          {nextLevel?<figure><CardArtwork name={`${card.name} 다음 등급`}/><figcaption><GradeBadge grade={nextLevel} label={cardLevelLabels[nextLevel]}/><span>받을 카드 1장</span></figcaption></figure>:<div className="bb-upgrade-max"><strong>LEGEND</strong><p>가장 높은 등급이에요</p></div>}
        </div>
      </section>
      <section className="bb-detail-info" aria-label="강화 수량 확인">
        <h2>수량 확인</h2>
        <dl className="bb-upgrade-quantities">
          <div><dt>현재 보유</dt><dd>{card.count}장</dd></div>
          <div><dt>필요 수량</dt><dd>{nextLevel?`${cost}장`:'강화 불가'}</dd></div>
          <div><dt>강화 후 기존 등급 잔여</dt><dd>{eligible?`${card.count-cost}장`:'강화 불가'}</dd></div>
        </dl>
        <p className="bb-detail-caption">강화 비용 {cost}장은 시안 기준이에요.</p>
      </section>
      <section className="bb-detail-upgrade" aria-labelledby="upgrade-confirm-title">
        <h2 id="upgrade-confirm-title">강화하기 전에</h2>
        {!nextLevel?<p>LEGEND는 최고 등급이라 강화할 수 없어요.</p>:missing>0?<p role="status">같은 {cardLevelLabels[card.grade]} 카드가 {missing}장 더 필요해요.</p>:<p>같은 카드 {cost}장을 사용해 다음 등급 1장을 받는 흐름을 미리 봐요. 실제 강화에서는 카드 소모를 되돌릴 수 없고, 입장 자격과 누적 획득 기록은 유지돼요.</p>}
        {eligible&&<label className="bb-upgrade-consent" htmlFor={confirmationId}><input id={confirmationId} type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>사용·획득·잔여 수량을 확인했어요</span></label>}
        <button className="bb-button" type="button" disabled={!eligible||!confirmed} onClick={showResult}>{!nextLevel?'최고 등급 카드':missing>0?`${missing}장 더 필요해요`:'강화 결과 미리보기'}</button>
        <p className="bb-detail-caption">미리보기에서는 실제 카드를 사용하지 않아요.</p>
      </section>
    </>}
  </div>;
}
