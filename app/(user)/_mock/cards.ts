import manifest from '@/docs/assets/card-images.json';
import {cardCategoryLabels,type CardCategory,type CardLevel} from '@/lib/cards/presentation';
import {cardFromTemplate,highestOwnedLevel,templateTotal,type CollectionTemplate} from '@/lib/cards/collection';

// 선수 식별자·유형만 제공된 manifest를 재사용한다. 실제 카드 이미지나 DB는 조회하지 않는다.
// c1/c2/c3는 UI 시나리오용 ID이며 인물 UUID 또는 기존 서버 등급의 매핑이 아니다.
const scenarios:Record<string,{id:string;counts:Record<CardLevel,number>}|undefined>={
  gong_tae_pung:{id:'c1',counts:{basic:3,rare:2,legend:0}},
  heo_in_saeng:{id:'c2',counts:{basic:11,rare:0,legend:0}},
  kim_jin_sil:{id:'c3',counts:{basic:0,rare:0,legend:1}},
};
const seen=new Set<string>();
export const mockCollectionTemplates:CollectionTemplate[]=manifest.assets.flatMap(asset=>{
  const key=`${asset.category}/${asset.playerSlug}`;
  if(seen.has(key))return [];
  seen.add(key);
  if(!(asset.category in cardCategoryLabels))throw new Error('Invalid card category in asset manifest');
  const scenario=scenarios[asset.playerSlug];
  return [{id:scenario?.id??`preview-${asset.category}-${asset.playerSlug}`,name:asset.playerSlug==='gong_tae_pung'?'공태풍':asset.playerSlug,category:asset.category as CardCategory,counts:scenario?.counts??{basic:0,rare:0,legend:0},verifiedAt:null}];
});
// 홈·이전 미리보기 URL에서 사용하는 대표 카드. 보유 데이터로 취급하지 않는다.
export const mockCards=mockCollectionTemplates.filter(t=>templateTotal(t)>0).map(t=>cardFromTemplate(t,highestOwnedLevel(t)!));
export type Grade=CardLevel;
export function findMockTemplate(id:string){return mockCollectionTemplates.find(t=>t.id===id);}
export function findMockCard(id:string,grade?:string|string[]){
  const template=findMockTemplate(id);
  if(!template)return undefined;
  const selected=grade??highestOwnedLevel(template)??'basic';
  if(selected!=='basic'&&selected!=='rare'&&selected!=='legend')return undefined;
  return cardFromTemplate(template,selected);
}
