'use client';
import Link from 'next/link';
import {useState} from 'react';
import {CardDrawReveal,type DrawRevealResult} from '@/components/card/card-draw-reveal';
import {cardLevelLabels} from '@/lib/cards/presentation';
import {cardLevels} from '@/lib/cards/collection';

// 미리보기 전용 틀: 목업 안내·등급 시나리오 전환·연출 다시 보기. 실제 /draw에는 CardDrawReveal만 사용한다.
export function DrawPreview({result}:{result:DrawRevealResult}){
  const [run,setRun]=useState(0);
  return <div className="bb-stack">
    <aside className="bb-detail-preview"><strong>뽑기 연출 목업</strong><p>실제 발급·추첨을 하지 않는 화면 확인용 예시예요. 카드 아트는 등록된 이미지 목록을, 보유 장수는 목업을 사용해요.</p></aside>
    <nav className="bb-chip-group" aria-label="미리보기 등급">{cardLevels.map(grade=><Link key={grade} className="bb-chip" data-grade={grade} href={`/draw/preview?grade=${grade}`} aria-current={grade===result.card.grade?'page':undefined}>{cardLevelLabels[grade]}</Link>)}</nav>
    <CardDrawReveal key={`${result.card.grade}-${run}`} result={result}/>
    <button type="button" className="bb-button bb-button--secondary" onClick={()=>setRun(n=>n+1)}>연출 다시 보기</button>
  </div>;
}
