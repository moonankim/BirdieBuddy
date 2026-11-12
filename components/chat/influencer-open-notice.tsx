'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {copy} from './copy';
const storageKey=(roomId:string)=>`birdiebuddy-open-notice-dismissed:${roomId}`;
export function InfluencerOpenNotice({roomId}:{roomId:string}){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{let dismissed=false;try{dismissed=localStorage.getItem(storageKey(roomId))==='1';}catch{}setVisible(!dismissed);},[roomId]);
  if(!visible)return null;
  return <div role="status" className="notice my-3">
    <p>{copy.influencerOpenNotice}</p>
    <div className="mt-2 flex gap-4"><Link href="/inbox/settings" className="button small no-underline">설정으로 가기</Link>
    <button type="button" onClick={()=>{try{localStorage.setItem(storageKey(roomId),'1');}catch{}setVisible(false);}}>확인했어요</button></div>
  </div>;
}
