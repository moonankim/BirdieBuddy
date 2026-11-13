import {redirect} from 'next/navigation';
import {Guard} from '@/components/chat/shell';
import {CardCatalog} from '@/components/card/card-catalog';

// 컬렉션(도감). 정적 카드 목록 화면이며 보유 카드는 /collection/owned에서 별도로 다룬다.
export default async function CollectionPage({searchParams}:{searchParams:Promise<{tab?:string|string[]}>}){
  if((await searchParams).tab==='owned')redirect('/collection/owned');
  return <Guard role="user"><CardCatalog/></Guard>;
}
