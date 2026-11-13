'use client';
import Link from 'next/link';
import {StatusScreen} from '@/components/ui';

// 예상하지 못한 화면 오류(design-system sample/states.html "연결 오류"). 다시 시도는 같은 화면을 다시 그린다.
export default function RouteError({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <StatusScreen art="/assets/connection-error.svg" title="화면을 불러오지 못했어요" alert actions={<><button type="button" className="button" onClick={()=>reset()}>다시 시도</button><Link className="button outline no-underline" href="/">홈으로</Link></>}>인터넷 연결을 확인한 후 다시 시도해 주세요.</StatusScreen>;
}
