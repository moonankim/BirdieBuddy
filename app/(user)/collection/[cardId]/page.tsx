import {notFound} from 'next/navigation';
import {Guard} from '@/components/chat/shell';
import {CardDetail} from '@/components/card/card-detail';
import {findMockCard,findMockTemplate} from '../../_mock/cards';

export default async function CardDetailPage({params,searchParams}:{params:Promise<{cardId:string}>;searchParams:Promise<{from?:string|string[];grade?:string|string[]}>}) {
  const {cardId}=await params;
  const {from,grade}=await searchParams;
  const card=findMockCard(cardId,grade);
  if(!card)notFound();
  return <Guard role="user"><CardDetail card={card} counts={findMockTemplate(cardId)?.counts} returnToOwned={from==='owned'}/></Guard>;
}
