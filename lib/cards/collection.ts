import {type CardLevel,type CardPreview,nextCardLevel} from './presentation';

export const cardLevels:CardLevel[]=['basic','rare','legend'];
// imageUrls는 정적 카드 목록(manifest)의 등급별 실제 아트. 보유 화면 목업은 공통 이미지를 쓴다.
export type CollectionTemplate=Omit<CardPreview,'grade'|'count'>&{counts:Record<CardLevel,number>;imageUrls?:Partial<Record<CardLevel,string>>};
export type CardFilters={player:string;category:string;grade:'all'|CardLevel;sort:'grade'|'count'};
export const initialCardFilters:CardFilters={player:'all',category:'all',grade:'all',sort:'grade'};
export function templateTotal(template:CollectionTemplate){return cardLevels.reduce((sum,grade)=>sum+template.counts[grade],0);}
export function highestOwnedLevel(template:CollectionTemplate){return [...cardLevels].reverse().find(grade=>template.counts[grade]>0)??null;}
export function cardFromTemplate(template:CollectionTemplate,grade:CardLevel):CardPreview{
  const {id,name,category,verifiedAt,counts}=template;
  return {id,name,category,verifiedAt,grade,count:counts[grade]};
}
export type CatalogCard=CardPreview&{imageUrl?:string};
export type CatalogFilters={category:string;grade:'all'|CardLevel};
export const initialCatalogFilters:CatalogFilters={category:'all',grade:'all'};
// 컬렉션(도감): 정적 카드 목록의 선수×등급 전체. 순서는 목록 순서·등급 순으로 고정한다.
export function selectCatalog(templates:CollectionTemplate[],filters:CatalogFilters):CatalogCard[]{
  return templates.filter(t=>filters.category==='all'||t.category===filters.category).flatMap(t=>cardLevels.filter(grade=>filters.grade==='all'||grade===filters.grade).map(grade=>({...cardFromTemplate(t,grade),imageUrl:t.imageUrls?.[grade]})));
}
export function ownedLevelCount(templates:CollectionTemplate[],grade:CardLevel){return templates.filter(t=>t.counts[grade]>0).length;}
export function canPreviewUpgrade(card:CardPreview,cost:number){return nextCardLevel[card.grade]!==null&&card.count>=cost;}
export function selectCollection(templates:CollectionTemplate[],filters:CardFilters){
  const visible=templates.filter(t=>(filters.player==='all'||t.id===filters.player)&&(filters.category==='all'||t.category===filters.category));
  return [...visible].sort((a,b)=>{
    const count=(t:CollectionTemplate)=>filters.grade==='all'?templateTotal(t):t.counts[filters.grade];
    const rank=(t:CollectionTemplate)=>{const grade=highestOwnedLevel(t);return grade?cardLevels.indexOf(grade)+1:0;};
    return (filters.sort==='count'?count(b)-count(a):rank(b)-rank(a))||a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id);
  });
}
export function selectOwned(templates:CollectionTemplate[],filters:CardFilters){
  return selectCollection(templates,filters).flatMap(t=>cardLevels.filter(grade=>t.counts[grade]>0&&(filters.grade==='all'||grade===filters.grade)).map(grade=>cardFromTemplate(t,grade))).sort((a,b)=>{
    return (filters.sort==='count'?b.count-a.count:cardLevels.indexOf(b.grade)-cardLevels.indexOf(a.grade))||a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id);
  });
}
