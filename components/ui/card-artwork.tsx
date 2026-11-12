'use client';
import {useState} from 'react';
import Image from 'next/image';
import type {ReactNode} from 'react';

export type CardGrade = 'common'|'rare'|'epic'|'special';
const labels:Record<CardGrade,string>={common:'일반',rare:'레어',epic:'에픽',special:'스페셜'};
export function GradeBadge({grade}:{grade:CardGrade}) {
  return <span className="bb-badge" data-grade={grade}>{labels[grade]}</span>;
}

// 최종 카드 아트와 구분되는 코드 기반 자리표시자. 이미지 재시도는 src 변경으로 수행한다.
export function CardArtwork({src,name,grade,unowned=false}:{src?:string|null;name:string;grade?:CardGrade;unowned?:boolean}) {
  const [failedSrc,setFailedSrc]=useState<string|null>(null);
  const showImage=Boolean(src)&&src!==failedSrc&&!unowned;
  return <div className="bb-card-figure"><div className="bb-card-art" data-state={unowned?'unowned':showImage?'image':'placeholder'}>
    {showImage ? <Image unoptimized src={src!} alt={`${name} 카드`} fill sizes="(max-width: 480px) 45vw, 200px" onError={()=>setFailedSrc(src!)}/> :
      <svg className="bb-card-placeholder" viewBox="0 0 200 300" role="img" aria-label={unowned?'미보유 카드':`${name} 카드 이미지 준비 중`}>
        <path d="M0 230Q80 180 200 225V300H0Z" fill="var(--border-subtle)"/>
        <circle cx="100" cy="115" r="28" fill="var(--text-secondary)"/>
        <path d="M50 235c0-53 17-82 50-82s50 29 50 82" fill="var(--text-secondary)"/>
      </svg>}
  </div>{grade&&<div className="bb-card-grade"><GradeBadge grade={grade}/></div>}</div>;
}

export function StatusPanel({title,children,tone='info',onRetry,retryLabel='다시 시도'}:{title:string;children?:ReactNode;tone?:'info'|'error'|'loading'|'empty';onRetry?:()=>void;retryLabel?:string}) {
  return <section className="bb-state" data-tone={tone} role={tone==='error'?'alert':'status'} aria-busy={tone==='loading'}>
    <strong>{title}</strong>{children&&<p>{children}</p>}
    {onRetry&&tone!=='loading'&&<button type="button" className="bb-button bb-button--secondary" onClick={onRetry}>{retryLabel}</button>}
  </section>;
}
