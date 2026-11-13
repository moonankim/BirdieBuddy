import Link from 'next/link';
import {StatusScreen} from '@/components/ui';

// 404(design-system sample/states.html "페이지를 찾을 수 없음").
export default function NotFound(){
  return <StatusScreen code="404" title="페이지를 찾을 수 없어요" actions={<Link className="button no-underline" href="/">홈으로</Link>}>주소가 바뀌었거나 존재하지 않는 페이지예요. 홈에서 다시 시작해 주세요.</StatusScreen>;
}
