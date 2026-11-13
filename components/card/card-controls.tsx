'use client';
import Link from 'next/link';
import type {CardLevel} from '@/lib/cards/presentation';

// 컬렉션(도감)과 보유 카드는 별도 화면이며 이 탭으로만 오간다.
export function CardTabs({current}:{current:'catalog'|'owned'}){
  return <nav className="tabs bb-collection-tabs" aria-label="카드 보기">
    <Link className={`tab ${current==='catalog'?'active':''}`} href="/collection" aria-current={current==='catalog'?'page':undefined}>컬렉션</Link>
    <Link className={`tab ${current==='owned'?'active':''}`} href="/collection/owned" aria-current={current==='owned'?'page':undefined}>보유 카드</Link>
  </nav>;
}

export type ChipOption<T extends string>={value:T;label:string;grade?:CardLevel};

// 디자인 시스템 칩 필터. 선택 상태는 aria-pressed와 채움으로, 등급 칩은 등급색으로 표시한다.
export function ChipGroup<T extends string>({label,value,options,onChange}:{label:string;value:T;options:ChipOption<T>[];onChange:(value:T)=>void}){
  return <div className="bb-chip-group" role="group" aria-label={label}>
    {options.map(option=><button key={option.value} type="button" className="bb-chip" data-grade={option.grade} aria-pressed={option.value===value} onClick={()=>onChange(option.value)}>{option.label}</button>)}
  </div>;
}

// 2~3개 선택지의 정렬 토글.
export function Segmented<T extends string>({label,value,options,onChange}:{label:string;value:T;options:ChipOption<T>[];onChange:(value:T)=>void}){
  return <div className="bb-segmented" role="group" aria-label={label}>
    {options.map(option=><button key={option.value} type="button" aria-pressed={option.value===value} onClick={()=>onChange(option.value)}>{option.label}</button>)}
  </div>;
}
