'use client';
import {useState} from 'react';
// 프로필 사진. 사진이 없거나 못 불러오면 기본 프로필(public/assets/avatar-default.svg, design-system AGENT_GUIDE)을 쓰고,
// 기본 이미지마저 실패하면 이름 첫 글자를 보여 준다. 이름은 옆에 표시되므로 이미지는 장식(alt="")이다.
export const DEFAULT_AVATAR='/assets/avatar-default.svg';
// 채팅방 인플루언서 썸네일 임시 이미지(2026-11-13 현호P 요청). 선수별 썸네일 속성이 SDK에 생기면 room 데이터의 값으로 바꾼다.
// 임시로 업로드된 프로필 사진보다 우선하므로 채팅방 목록·상단·말풍선에만 쓰고 인박스 설정에는 쓰지 않는다.
export const TEMP_INFLUENCER_THUMBNAIL='https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/thumbnail/choi-na-bee-thumb.png';
export function Avatar({src,name,size="md"}:{src:string|null;name:string;size?:"sm"|"md"}){
  const [failed,setFailed]=useState<ReadonlySet<string>>(new Set());
  const url=[src,DEFAULT_AVATAR].find(candidate=>candidate&&!failed.has(candidate))??null;
  return <span className={`avatar overflow-hidden ${size==="sm"?"!h-8 !w-8 text-xs":""}`} aria-label={name}>
    {url?<img src={url} alt="" className="h-full w-full object-cover" onError={()=>setFailed(previous=>new Set(previous).add(url))}/>:<span aria-hidden="true">{Array.from(name)[0]??'?'}</span>}
  </span>;
}
