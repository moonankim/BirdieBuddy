'use client';
import Link from 'next/link';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {CardArtwork,GradeBadge} from '@/components/ui/card-artwork';
import {cardLevels} from '@/lib/cards/collection';
import {cardCategoryLabels,cardLevelLabels,nextCardLevel,previewUpgradeCost,previewCardImageUrl,upgradeRevealMs,type CardLevel,type CardPreview} from '@/lib/cards/presentation';

// 연출용으로 겹쳐 보이는 카드 위치. 실제 소모 장수와 무관한 장식이다.
const gatherOffsets=[[-72,-36,-12],[72,-28,10],[-60,52,8],[64,60,-9],[0,-84,4]] as const;
function prefersReducedMotion(){return typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}

type Phase='confirm'|'revealing'|'result';

// 강화의 화면 흐름만 확인한다. 서버 요청·카드 수량 변경·저장은 수행하지 않는다.
// 실제 연결 시 'revealing'은 서버 성공 확인 뒤에만 시작하고, 건너뛰기·이탈은 확정 결과를 바꾸지 않는다.
export function CardUpgrade({card,nextCount,returnToOwned=false}:{card:CardPreview;nextCount?:number;returnToOwned?:boolean}) {
  const [confirmed,setConfirmed]=useState(false);
  const [phase,setPhase]=useState<Phase>('confirm');
  const [result,setResult]=useState<{grade:CardLevel;remaining:number}|null>(null);
  const confirmationId=useId();
  const resultHeading=useRef<HTMLHeadingElement>(null);
  const nextLevel=nextCardLevel[card.grade];
  const revealMs=nextLevel&&nextLevel!=='basic'?upgradeRevealMs[nextLevel]:0;
  useEffect(()=>{if(phase==='result')resultHeading.current?.focus();},[phase]);
  useEffect(()=>{
    if(phase!=='revealing')return;
    const timer=window.setTimeout(()=>setPhase('result'),revealMs);
    return ()=>window.clearTimeout(timer);
  },[phase,revealMs]);
  const cost=previewUpgradeCost;
  const missing=Math.max(0,cost-card.count);
  const eligible=nextLevel!==null&&missing===0;
  const detailHref=`/collection/${encodeURIComponent(card.id)}?grade=${card.grade}${returnToOwned?'&from=owned':''}`;
  const collectionHref=returnToOwned?'/collection/owned':'/collection';
  const showResult=()=>{
    if(!confirmed||!nextLevel||missing>0||result)return;
    setResult({grade:nextLevel,remaining:card.count-cost});
    setPhase(prefersReducedMotion()?'result':'revealing');
  };
  return <div className="bb-detail">
    <Link className="bb-detail-back" href={detailHref}>
      <svg className="bb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>카드 상세로
    </Link>
    <header className="bb-detail-heading">
      <span className="bb-detail-category">{cardCategoryLabels[card.category]} · {card.name}</span>
      <h1 className="page-title bb-poster-title" ref={resultHeading} tabIndex={-1}>{phase==='result'?'강화 결과 미리보기':phase==='revealing'?'카드 강화 중':'카드 강화'}</h1>
      <p className="bb-detail-caption">{phase==='result'?'모은 카드가 다음 등급으로.':phase==='revealing'?'모은 카드가 하나로 합쳐지고 있어요.':'사용할 카드와 받을 카드를 확인해 주세요.'}</p>
    </header>
    <aside className="bb-detail-preview"><strong>목업 미리보기</strong><p>디폴트 카드로 구성한 화면이에요. 실제 카드·보유 장수·계정 정보는 바뀌지 않고, 돌아가거나 새로고침하면 미리보기 결과는 초기화돼요.</p></aside>
    {phase==='revealing'&&result?<>
      <section className="bb-detail-showcase bb-upgrade-reveal" data-level={result.grade} style={{'--reveal-ms':`${revealMs}ms`} as CSSProperties} aria-label="강화 연출">
        <div className="bb-upgrade-stage" aria-hidden="true">
          {gatherOffsets.map(([x,y,r],index)=><span key={index} className="bb-upgrade-chip" style={{'--x':`${x}px`,'--y':`${y}px`,'--r':`${r}deg`} as CSSProperties}/>)}
          <div className="bb-upgrade-reveal-card"><CardArtwork src={previewCardImageUrl} name={card.name}/></div>
        </div>
        <p role="status">{cardLevelLabels[card.grade]} 카드 {cost}장을 모아 {cardLevelLabels[result.grade]} 카드를 만들고 있어요.</p>
      </section>
      <button className="bb-button bb-button--secondary" type="button" onClick={()=>setPhase('result')}>연출 건너뛰기</button>
    </>:phase==='result'&&result?<>
      <figure className="bb-detail-showcase bb-upgrade-result" data-level={result.grade}>
        <GradeBadge grade={result.grade} label={cardLevelLabels[result.grade]}/>
        <div className="bb-detail-art"><CardArtwork src={previewCardImageUrl} name={card.name}/></div>
        <figcaption>{card.name} · {cardLevelLabels[result.grade]} 카드 1장 획득 예시</figcaption>
      </figure>
      <section className="bb-detail-levels" aria-label="강화 후 등급"><p className="bb-eyebrow" aria-hidden="true">Level up</p><ol className="bb-level-track">{cardLevels.map(grade=><li key={grade} className="bb-level" data-grade={grade} aria-current={grade===result.grade?'step':undefined}><span className="bb-level-tag">{cardLevelLabels[grade]}</span></li>)}</ol></section>
      <section className="bb-detail-info" aria-label="강화 결과 수량">
        <h2>미리보기 결과</h2>
        <dl className="bb-upgrade-quantities">
          <div><dt>사용한 {cardLevelLabels[card.grade]} 카드</dt><dd>{cost}장</dd></div>
          <div><dt>받은 {cardLevelLabels[result.grade]} 카드</dt><dd>1장</dd></div>
          {nextCount!==undefined&&<div><dt>보유 {cardLevelLabels[result.grade]} 카드</dt><dd>{nextCount}장 → {nextCount+1}장</dd></div>}
          <div><dt>남은 {cardLevelLabels[card.grade]} 카드</dt><dd>{result.remaining}장</dd></div>
        </dl>
        <p className="bb-detail-caption">실제 보유 수량이 아닌 이 화면의 계산 예시예요. 입장 자격·보유 배지·누적 획득 기록은 그대로예요.</p>
      </section>
      <div className="bb-upgrade-actions"><Link className="bb-button" href={collectionHref}>{returnToOwned?'보유 카드로':'컬렉션으로'}</Link><Link className="bb-button bb-button--secondary" href={detailHref}>카드 상세로 돌아가기</Link></div>
    </>:<>
      <section className="bb-detail-info" aria-label="강화 전후 카드">
        <div className="bb-upgrade-pair">
          <figure><CardArtwork src={previewCardImageUrl} name={`${card.name} 현재 등급`}/><figcaption><GradeBadge grade={card.grade} label={cardLevelLabels[card.grade]}/><span>{nextLevel?`사용 카드 ${cost}장`:'현재 카드'}</span></figcaption></figure>
          <svg className="bb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>
          {nextLevel?<figure><CardArtwork src={previewCardImageUrl} name={`${card.name} 다음 등급`}/><figcaption><GradeBadge grade={nextLevel} label={cardLevelLabels[nextLevel]}/><span>받을 카드 1장</span></figcaption></figure>:<div className="bb-upgrade-max"><strong>LEGEND</strong><p>가장 높은 등급이에요</p></div>}
        </div>
      </section>
      <section className="bb-detail-info" aria-label="강화 수량 확인">
        <h2>수량 확인</h2>
        <dl className="bb-upgrade-quantities">
          <div><dt>현재 보유</dt><dd>{card.count}장</dd></div>
          <div><dt>필요 수량</dt><dd>{nextLevel?`${cost}장`:'강화 불가'}</dd></div>
          {nextLevel&&nextCount!==undefined&&<div><dt>보유 {cardLevelLabels[nextLevel]} 카드</dt><dd>{nextCount}장</dd></div>}
          <div><dt>강화 후 기존 등급 잔여</dt><dd>{eligible?`${card.count-cost}장`:'강화 불가'}</dd></div>
        </dl>
        <p className="bb-detail-caption">강화 비용 {cost}장은 시안 기준이에요.</p>
      </section>
      <section className="bb-detail-upgrade" aria-labelledby="upgrade-confirm-title">
        <h2 id="upgrade-confirm-title">강화하기 전에</h2>
        {!nextLevel?<p>LEGEND는 최고 등급이라 강화할 수 없어요.</p>:missing>0?<p role="status">같은 {cardLevelLabels[card.grade]} 카드가 {missing}장 더 필요해요.</p>:<p>같은 카드 {cost}장을 사용해 다음 등급 1장을 받는 흐름을 미리 봐요. 실제 강화에서는 카드 소모를 되돌릴 수 없어요. 현재 장수만 줄고 입장 자격·보유 배지·누적 획득 기록은 유지돼요.</p>}
        {eligible&&<label className="bb-upgrade-consent" htmlFor={confirmationId}><input id={confirmationId} type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>사용·획득·잔여 수량을 확인했어요</span></label>}
        <button className="bb-button" type="button" disabled={!eligible||!confirmed} onClick={showResult}>{!nextLevel?'최고 등급 카드':missing>0?`${missing}장 더 필요해요`:'강화 결과 미리보기'}</button>
        <p className="bb-detail-caption">미리보기에서는 실제 카드를 사용하지 않아요.</p>
      </section>
    </>}
  </div>;
}
