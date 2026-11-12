import {notFound} from 'next/navigation';
import {Guard} from '@/components/chat/shell';
import {CardUpgrade} from '@/components/card/card-upgrade';
import {findMockCard} from '../../_mock/cards';

export default async function CardUpgradePage({searchParams}:{searchParams:Promise<{cardId?:string|string[];from?:string|string[];grade?:string|string[]}>}) {
  const {cardId,from,grade}=await searchParams;
  const card=typeof cardId==='string'?findMockCard(cardId,grade):undefined;
  if(!card)notFound();
  return <Guard role="user"><CardUpgrade key={`${card.id}-${card.grade}`} card={card} returnToOwned={from==='owned'}/></Guard>;
}
