import type {CardLevel} from '@/lib/cards/presentation';
import {cardFromTemplate,templateTotal} from '@/lib/cards/collection';
import type {DrawRevealResult} from '@/components/card/card-draw-reveal';
import {mockCollectionTemplates} from './cards';

// 뽑기 연출 미리보기용 목업 발급 결과. 실제 발급(completeRound)·추첨·수량 변경을 하지 않는다.
// 카드 목록·아트는 정적 manifest, 보유 수량은 컬렉션 목업 시나리오를 따른다.
const previewTemplateId='preview-gtour-kim_hong_cha';

export function isCardLevel(value:unknown):value is CardLevel{return value==='basic'||value==='rare'||value==='legend';}

export function mockDrawResult({grade,isNew,entryUnlocked=false}:{grade:CardLevel;isNew?:boolean;entryUnlocked?:boolean}):DrawRevealResult|undefined{
  const template=mockCollectionTemplates.find(t=>t.id===previewTemplateId);
  if(!template)return undefined;
  const card=cardFromTemplate(template,grade);
  return {
    card:{...card,imageUrl:template.imageUrls?.[grade]},
    // 발급 직후 수량(이전 수량 + 1). 신규 여부는 해당 선수의 모든 등급 보유가 0이었는지로 정한다.
    ownedCount:card.count+1,
    isNew:isNew??templateTotal(template)===0,
    entryUnlocked,
  };
}
