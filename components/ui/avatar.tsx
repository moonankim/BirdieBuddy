'use client';
import {useState} from 'react';
// 프로필 사진. 사진이 없거나 못 불러오면 기본 프로필(public/assets/avatar-default.svg, design-system AGENT_GUIDE)을 쓰고,
// 기본 이미지마저 실패하면 이름 첫 글자를 보여 준다. 이름은 옆에 표시되므로 이미지는 장식(alt="")이다.
export const DEFAULT_AVATAR='/assets/avatar-default.svg';
export function Avatar({src,name,size="md"}:{src:string|null;name:string;size?:"sm"|"md"}){
  const [failed,setFailed]=useState<ReadonlySet<string>>(new Set());
  const url=[src,DEFAULT_AVATAR].find(candidate=>candidate&&!failed.has(candidate))??null;
  return <span className={`avatar overflow-hidden ${size==="sm"?"!h-8 !w-8 text-xs":""}`} aria-label={name}>
    {url?<img src={url} alt="" className="h-full w-full object-cover" onError={()=>setFailed(previous=>new Set(previous).add(url))}/>:<span aria-hidden="true">{Array.from(name)[0]??'?'}</span>}
  </span>;
}
