import {redirect} from 'next/navigation';
import {Guard} from '@/components/chat/shell';
import {CardCollection} from '@/components/card/card-collection';

export default async function CollectionPage({searchParams}:{searchParams:Promise<{tab?:string|string[]}>}){
  if((await searchParams).tab==='owned')redirect('/collection/owned');
  return <Guard role="user"><CardCollection/></Guard>;
}
