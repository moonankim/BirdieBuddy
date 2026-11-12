'use client';
import {useCallback,useEffect,useState} from 'react';
import {Guard} from '@/components/chat/shell';
import {useChatApi} from '@/components/chat/api/chat-api';
import {errorText} from '@/components/chat/copy';
import {CardArtwork,StatusPanel} from '@/components/ui/card-artwork';
import type {ApiError,CollectionItem,Grade,OwnedCardItem} from '@/lib/api/types';
import {byBestCard,gradeLabel,gradeOrder,styleLabel} from '../_lib/cards';

// 컬렉션(미보유 포함)과 보유 카드(1장 이상). 디자인·강화·상세는 현호P 화면에서 보강한다.
type Filter='all'|Grade;

function Collection(){
  const api=useChatApi();
  const [tab,setTab]=useState<'all'|'owned'>('all');
  const [grade,setGrade]=useState<Filter>('all');
  const [collection,setCollection]=useState<CollectionItem[]|null>(null);
  const [owned,setOwned]=useState<OwnedCardItem[]|null>(null);
  const [error,setError]=useState<ApiError|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('tab')==='owned')setTab('owned');},[]);
  useEffect(()=>{
    let active=true;setError(null);setCollection(null);setOwned(null);
    void Promise.all([api.getCollection(),api.getOwnedCards()]).then(([all,mine])=>{
      if(!active)return;
      if(!all.ok){setError(all.error);return;}
      if(!mine.ok){setError(mine.error);return;}
      setCollection(all.data.items);setOwned(mine.data.items);
    }).catch(()=>{if(active)setError({code:'NETWORK_ERROR',message:'',retryable:true});});
    return()=>{active=false;};
  },[api,revision]);
  const retry=useCallback(()=>setRevision(v=>v+1),[]);

  const collected=collection?.filter(item=>item.totalCards>0).length??0;
  const total=collection?.length??0;
  const allCards=(collection??[]).filter(item=>grade==='all'||item.counts[grade]>0);
  const ownedCards=[...(owned??[])].filter(item=>grade==='all'||item.grade===grade).sort(byBestCard);
  const empty=tab==='all'?allCards.length===0:ownedCards.length===0;

  return <div>
    <p className="eyebrow mt-2">MY COLLECTION</p>
    <h1 className="page-title mt-1">차곡차곡, 나의 버디</h1>
    <div className="statline mt-4 mb-2 flex justify-between text-[length:var(--type-caption)] text-[var(--text-secondary)]">수집한 카드 템플릿 <strong className="text-[var(--text-accent)]">{collected} / {total}</strong></div>
    <div className="progress" role="progressbar" aria-label="카드 템플릿 수집 현황" aria-valuenow={collected} aria-valuemin={0} aria-valuemax={total}><span style={{width:`${total?collected/total*100:0}%`}}/></div>
    <div className="tabs" aria-label="카드 보기">
      <button className={`tab ${tab==='all'?'active':''}`} type="button" aria-pressed={tab==='all'} onClick={()=>setTab('all')}>컬렉션</button>
      <button className={`tab ${tab==='owned'?'active':''}`} type="button" aria-pressed={tab==='owned'} onClick={()=>setTab('owned')}>보유 카드</button>
    </div>
    <div className="filters" aria-label="등급 필터">
      {(['all',...gradeOrder] as Filter[]).map(g=><button key={g} className={`filter ${grade===g?'active':''}`} type="button" aria-pressed={grade===g} onClick={()=>setGrade(g)}>{g==='all'?'전체':gradeLabel[g]}</button>)}
    </div>
    {error?<StatusPanel tone="error" title="카드를 불러오지 못했어요" onRetry={error.retryable||error.code==='NETWORK_ERROR'?retry:undefined}>{errorText(error.code,error.details)}</StatusPanel>
      :collection===null?<StatusPanel tone="loading" title="카드를 불러오는 중이에요"/>
      :<div className="section-mini"><div className="section-head"><h2>{tab==='all'?'나의 컬렉션':'보유 카드'}</h2></div>
        <div className="card-grid">
          {tab==='all'?allCards.map(item=>{const owns=item.totalCards>0;const shown=grade==='all'?item.highestGrade:grade;
            return <article key={item.template.id} className="card-tile">
              <CardArtwork src={item.template.imageUrl} name={item.template.influencerName} grade={owns&&shown?shown:undefined} unowned={!owns}/>
              <h3>{owns?item.template.influencerName:'미보유 카드'}</h3>
              <p>{owns?styleLabel[item.template.style]:`${item.template.influencerName} · ${styleLabel[item.template.style]}`}</p>
              {owns?<strong>{grade==='all'?item.totalCards:item.counts[grade]}장 보유</strong>:<p>아직 만나지 못했어요</p>}
            </article>;})
          :ownedCards.map(item=><article key={`${item.template.id}:${item.grade}`} className="card-tile">
              <CardArtwork src={item.template.imageUrl} name={item.template.influencerName} grade={item.grade}/>
              <h3>{item.template.influencerName}</h3><p>{styleLabel[item.template.style]} · {gradeLabel[item.grade]}</p><strong>{item.count}장 보유</strong>
            </article>)}
        </div>
        {empty&&<StatusPanel tone="empty" title={tab==='owned'&&grade==='all'?'아직 보유한 카드가 없어요':'조건에 맞는 카드가 없어요'} onRetry={grade==='all'?undefined:()=>setGrade('all')} retryLabel="필터 초기화">{tab==='owned'&&grade==='all'?'라운드를 마치면 카드가 찾아와요.':'필터를 바꿔 보세요.'}</StatusPanel>}
      </div>}
  </div>;
}
export default function CollectionPage(){return <Guard role="user"><Collection/></Guard>;}
