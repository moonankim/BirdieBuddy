import {type CardLevel,type CardPreview,nextCardLevel} from './presentation';

export const cardLevels:CardLevel[]=['basic','rare','legend'];
export type CollectionTemplate=Omit<CardPreview,'grade'|'count'>&{counts:Record<CardLevel,number>};
export type CardFilters={player:string;category:string;grade:'all'|CardLevel;sort:'grade'|'count'};
export const initialCardFilters:CardFilters={player:'all',category:'all',grade:'all',sort:'grade'};
export function templateTotal(template:CollectionTemplate){return cardLevels.reduce((sum,grade)=>sum+template.counts[grade],0);}
export function highestOwnedLevel(template:CollectionTemplate){return [...cardLevels].reverse().find(grade=>template.counts[grade]>0)??null;}
export function cardFromTemplate(template:CollectionTemplate,grade:CardLevel):CardPreview{
  const {counts,...meta}=template;
  return {...meta,grade,count:counts[grade]};
}
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
