'use client';
import {useState} from 'react';
import Image from 'next/image';
import type {ReactNode} from 'react';

// SDK 전환 중에는 기존 화면의 등급도 보존한다. 실제 데이터의 등급 변환은 하지 않는다.
export type CardGrade = 'basic'|'rare'|'legend'|'common'|'epic'|'special';
const labels:Record<CardGrade,string>={basic:'BASIC',rare:'레어',legend:'LEGEND',common:'일반',epic:'에픽',special:'스페셜'};
export function GradeBadge({grade,label}:{grade:CardGrade;label?:string}) {
  return <span className="bb-badge" data-grade={grade}>{label??labels[grade]}</span>;
}

// 최종 카드 아트와 구분되는 코드 기반 자리표시자. 이미지 재시도는 src 변경으로 수행한다.
// unowned는 아트를 숨기고 실루엣을, locked는 컬렉션(도감)에서 아트를 흑백으로 보여 준다.
export function CardArtwork({src,name,grade,unowned=false,locked=false}:{src?:string|null;name:string;grade?:CardGrade;unowned?:boolean;locked?:boolean}) {
  const [failedSrc,setFailedSrc]=useState<string|null>(null);
  const showImage=Boolean(src)&&src!==failedSrc&&!unowned;
  return <div className="bb-card-figure"><div className="bb-card-art" data-state={unowned?'unowned':showImage?(locked?'locked':'image'):'placeholder'}>
    {showImage ? <Image unoptimized src={src!} alt={locked?`${name} 카드 (미보유)`:`${name} 카드`} fill sizes="(max-width: 480px) 45vw, 200px" onError={()=>setFailedSrc(src!)}/> :
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
