import manifest from '@/docs/assets/card-images.json';
import {cardCategoryLabels,type CardCategory,type CardLevel} from '@/lib/cards/presentation';
import {cardFromTemplate,highestOwnedLevel,templateTotal,type CollectionTemplate} from '@/lib/cards/collection';

// 카드 목록(선수·유형·등급별 이미지)은 정적 manifest가 원본이다. 보유 수량(counts)만 UI 시나리오 목업이며 DB는 조회하지 않는다.
// c1/c2/c3는 UI 시나리오용 ID이며 인물 UUID 또는 기존 서버 등급의 매핑이 아니다.
const scenarios:Record<string,{id:string;counts:Record<CardLevel,number>}|undefined>={
  gong_tae_pung:{id:'c1',counts:{basic:3,rare:2,legend:0}},
  heo_in_saeng:{id:'c2',counts:{basic:11,rare:0,legend:0}},
  kim_jin_sil:{id:'c3',counts:{basic:0,rare:0,legend:1}},
};
// 실제 카드 아트로 확인된 한글 표기만 사용한다. 나머지는 slug를 그대로 표시한다.
const confirmedNames:Record<string,string|undefined>={gong_tae_pung:'공태풍',kim_hong_cha:'김홍차'};
const seen=new Set<string>();
const imageUrls=new Map<string,Partial<Record<CardLevel,string>>>();
for(const asset of manifest.assets){
  const key=`${asset.category}/${asset.playerSlug}`;
  imageUrls.set(key,{...imageUrls.get(key),[asset.grade]:asset.imageUrl});
}
export const mockCollectionTemplates:CollectionTemplate[]=manifest.assets.flatMap(asset=>{
  const key=`${asset.category}/${asset.playerSlug}`;
  if(seen.has(key))return [];
  seen.add(key);
  if(!(asset.category in cardCategoryLabels))throw new Error('Invalid card category in asset manifest');
  const scenario=scenarios[asset.playerSlug];
  return [{id:scenario?.id??`preview-${asset.category}-${asset.playerSlug}`,name:confirmedNames[asset.playerSlug]??asset.playerSlug,category:asset.category as CardCategory,counts:scenario?.counts??{basic:0,rare:0,legend:0},imageUrls:imageUrls.get(key),verifiedAt:null}];
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
