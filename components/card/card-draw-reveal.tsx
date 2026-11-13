'use client';
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {CardArtwork} from '@/components/ui/card-artwork';
import {cardCategoryLabels,cardLevelLabels,drawCardBackImageUrl,drawRevealTiming,type CardPreview} from '@/lib/cards/presentation';
import {cardLevels} from '@/lib/cards/collection';
import {prefersReducedMotion} from '@/lib/cards/motion';

export type DrawRevealResult={card:CardPreview&{imageUrl?:string};isNew:boolean;ownedCount:number;entryUnlocked:boolean};
type Phase='intro'|'heartbeat'|'ready'|'flip'|'result';

// 연출 장식용 반짝임 위치. 등급 암시(RARE·LEGEND)에만 보인다.
const sparkles=[[12,18],[84,12],[8,70],[90,64],[50,4],[30,92],[72,90]] as const;

function vibrate(pattern:number[]){try{if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')navigator.vibrate(pattern);}catch{}}

// 확정된 발급 결과를 "두근두근 → 탭해서 뒤집기"로 공개한다.
// 연출·탭·건너뛰기·이탈은 결과를 바꾸지 않으며 이 컴포넌트는 발급 요청을 하지 않는다.
export function CardDrawReveal({result,autoRevealMs=drawRevealTiming.autoRevealMs}:{result:DrawRevealResult;autoRevealMs?:number}){
  const {card,isNew,ownedCount,entryUnlocked}=result;
  const beats=drawRevealTiming.beats[card.grade];
  const [phase,setPhase]=useState<Phase>('intro');
  const resultHeading=useRef<HTMLHeadingElement>(null);
  // 서버·클라이언트 첫 렌더를 맞추기 위해 동작 줄이기 확인은 마운트 후에 한다.
  useEffect(()=>{if(prefersReducedMotion())setPhase('result');},[]);

  useEffect(()=>{
    const timers:number[]=[];
    const after=(ms:number,next:()=>void)=>timers.push(window.setTimeout(next,ms));
    if(phase==='intro')after(drawRevealTiming.introMs,()=>setPhase('heartbeat'));
    if(phase==='heartbeat'){
      for(let i=0;i<beats;i++)after(i*drawRevealTiming.beatMs,()=>vibrate([40,90,60]));
      after(beats*drawRevealTiming.beatMs,()=>setPhase('ready'));
    }
    if(phase==='ready')after(autoRevealMs,()=>setPhase('flip'));
    if(phase==='flip')after(drawRevealTiming.flipMs,()=>setPhase('result'));
    if(phase==='result')resultHeading.current?.focus();
    return ()=>timers.forEach(id=>window.clearTimeout(id));
  },[phase,beats,autoRevealMs]);

  const revealed=phase==='flip'||phase==='result';
  const status=phase==='intro'?'어떤 카드가 왔을까요?':phase==='heartbeat'?'두근두근… 카드가 깨어나고 있어요':phase==='ready'?'카드를 눌러 열어 보세요':phase==='flip'?'카드를 공개하고 있어요':'';
  return <div className="bb-draw">
    <section className="bb-draw-stage" data-grade={card.grade} data-phase={phase} style={{'--beat-ms':`${drawRevealTiming.beatMs}ms`,'--beats':beats,'--flip-ms':`${drawRevealTiming.flipMs}ms`} as CSSProperties} aria-label="카드 공개">
      <div className="bb-draw-burst" aria-hidden="true"/>
      {card.grade!=='basic'&&<div className="bb-draw-sparkles" aria-hidden="true">{sparkles.map(([x,y],i)=><span key={i} style={{left:`${x}%`,top:`${y}%`,animationDelay:`${i*180}ms`}}/>)}</div>}
      <button type="button" className="bb-draw-card" onClick={()=>{if(phase==='ready')setPhase('flip');}} aria-disabled={phase!=='ready'} aria-label={revealed?`${card.name} ${cardLevelLabels[card.grade]} 카드`:phase==='ready'?'카드 열기':'카드 준비 중'}>
        <span className="bb-draw-card-inner">
          <span className="bb-draw-face bb-draw-face--back" aria-hidden="true"><Image className="bb-draw-back-art" src={drawCardBackImageUrl} alt="" fill sizes="(max-width: 480px) 70vw, 320px" unoptimized priority draggable={false}/></span>
          <span className="bb-draw-face bb-draw-face--front">{revealed&&<CardArtwork src={card.imageUrl} name={`${card.name} ${cardLevelLabels[card.grade]}`}/>}</span>
        </span>
      </button>
      {phase!=='result'&&<p className="bb-draw-status" role="status">{status}</p>}
    </section>
    {phase!=='result'&&phase!=='flip'&&<button type="button" className="bb-button bb-button--secondary bb-draw-skip" onClick={()=>setPhase('result')}>건너뛰기</button>}
    {phase==='result'&&<section className="bb-draw-result" aria-labelledby="draw-result-title">
      <p className="bb-eyebrow" aria-hidden="true">Round complete</p>
      <div className="bb-draw-result-meta"><span className="bb-tag" data-grade={card.grade}>{cardCategoryLabels[card.category]}</span><span className={`bb-draw-new${isNew?'':' bb-draw-new--dup'}`}>{isNew?'NEW':'+1장'}</span></div>
      <h1 id="draw-result-title" className="page-title bb-poster-title" ref={resultHeading} tabIndex={-1}>{card.name}</h1>
      <p className="bb-draw-result-line">{cardLevelLabels[card.grade]} 카드가 도착했어요 · 이 등급 {ownedCount}장 보유 (예시)</p>
      <ol className="bb-level-track" aria-label="받은 카드 등급">{cardLevels.map(grade=><li key={grade} className="bb-level" data-grade={grade} aria-current={grade===card.grade?'step':undefined}><span className="bb-level-tag">{cardLevelLabels[grade]}</span></li>)}</ol>
      {entryUnlocked&&<div className="bb-state" data-tone="info"><strong>{card.name} 채팅방에 입장할 수 있어요 (예시)</strong><p>카드를 5장 모아 채팅방이 열렸어요.</p><Link className="bb-button" href="/chat">채팅방 보기</Link></div>}
      <div className="bb-draw-actions">
        <Link className="bb-button" href="/collection">컬렉션 보기</Link>
        <Link className="bb-button bb-button--secondary" href="/collection/owned">보유 카드</Link>
        <Link className="bb-button bb-button--secondary" href="/home">홈으로</Link>
      </div>
    </section>}
  </div>;
}
