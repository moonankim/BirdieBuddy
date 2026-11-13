import {notFound,redirect} from 'next/navigation';
import {Guard} from '@/components/chat/shell';
import {CardDetail} from '@/components/card/card-detail';
import {findMockCard,findMockTemplate} from '../../_mock/cards';

export default async function CardDetailPage({params,searchParams}:{params:Promise<{cardId:string}>;searchParams:Promise<{from?:string|string[];grade?:string|string[]}>}) {
  const {cardId}=await params;
  const {from,grade}=await searchParams;
  const card=findMockCard(cardId,grade);
  if(!card)notFound();
  // 상세는 보유 카드만 제공한다. 0장(직접 주소·강화로 모두 사용)이면 보유 카드 목록으로 보낸다.
  if(card.count<=0)redirect('/collection/owned');
  return <Guard role="user"><CardDetail card={card} counts={findMockTemplate(cardId)?.counts} returnToOwned={from==='owned'}/></Guard>;
}
