import {notFound} from 'next/navigation';
import {Guard} from '@/components/chat/shell';
import {isCardLevel,mockDrawResult} from '../../_mock/draw';
import {DrawPreview} from './draw-preview';

// 뽑기 연출 목업(/draw/preview). 실제 발급 결과 화면 /draw(자성P, API 연결)와 분리한다.
// 예: /draw/preview?grade=legend&new=1&unlocked=1
export default async function DrawPreviewPage({searchParams}:{searchParams:Promise<{grade?:string|string[];new?:string|string[];unlocked?:string|string[]}>}){
  const params=await searchParams;
  const grade=params.grade??'basic';
  if(!isCardLevel(grade))notFound();
  const result=mockDrawResult({grade,isNew:params.new===undefined?undefined:params.new==='1',entryUnlocked:params.unlocked==='1'});
  if(!result)notFound();
  return <Guard role="user"><DrawPreview result={result}/></Guard>;
}
