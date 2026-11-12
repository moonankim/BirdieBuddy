import {render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {CardDetail} from '@/components/card/card-detail';
import type {CardPreview} from '@/lib/cards/presentation';
import CardDetailPage from '@/app/(user)/collection/[cardId]/page';

vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('CARD_NOT_FOUND');}}));
vi.mock('@/components/chat/shell',()=>({Guard:({children}:{children:ReactNode})=><>{children}</>}));
const card:CardPreview={id:'preview',name:'예시 선수',category:'gtour',grade:'basic',count:9,verifiedAt:null};

describe('카드 상세 목업',()=>{
  it('실제 이미지를 요청하지 않고 디폴트·유형·등급·수량과 목업 안내를 표시한다',()=>{
    const {container}=render(<CardDetail card={card}/>);
    expect(screen.getByRole('heading',{level:1,name:'예시 선수'})).toBeInTheDocument();
    expect(screen.getByRole('img',{name:'예시 선수 카드 이미지 준비 중'})).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('목업 데이터')).toBeInTheDocument();
    expect(screen.getByText('보유 장수').parentElement).toHaveTextContent('9장');
    expect(screen.queryByText('인증됨')).toBeNull();
    expect(screen.queryByText('일러스트')).toBeNull();
  });
  it.each([[0,'10장 더 필요해요'],[9,'1장 더 필요해요']])('보유 %i장에서 강화 요청 없이 상태만 안내한다',(count,label)=>{
    const {container}=render(<CardDetail card={{...card,count}}/>);
    expect(screen.getByRole('button',{name:label})).toBeDisabled();
    expect(screen.getByRole('progressbar',{name:'강화 준비 수량'})).toHaveAttribute('value',String(Math.min(count,10)));
    expect(container.querySelector('a[href*="upgrade"]')).toBeNull();
  });
  it.each([10,11])('보유 %i장이면 실제 차감 없이 강화 목업 화면으로 이동한다',(count)=>{
    render(<CardDetail card={{...card,count}} returnToOwned/>);
    expect(screen.getByRole('link',{name:'강화 미리보기'})).toHaveAttribute('href','/collection/upgrade?cardId=preview&grade=basic&from=owned');
  });
  it('LEGEND에는 다음 강화나 필요 수량을 안내하지 않는다',()=>{
    render(<CardDetail card={{...card,grade:'legend',count:20}}/>);
    expect(screen.getByRole('heading',{name:'최고 등급 카드'})).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('인증 근거가 전달된 경우에만 인증 배지를 표시하고 보유 카드 탭으로 돌아간다',()=>{
    render(<CardDetail card={{...card,verifiedAt:'2026-11-12T00:00:00Z'}} returnToOwned/>);
    expect(screen.getByText('인증됨')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'보유 카드로'})).toHaveAttribute('href','/collection/owned');
  });
});

describe('카드 상세 주소',()=>{
  it('없는 카드 ID를 임의의 카드로 대체하지 않는다',async()=>{
    await expect(CardDetailPage({params:Promise.resolve({cardId:'not-a-card'}),searchParams:Promise.resolve({})})).rejects.toThrow('CARD_NOT_FOUND');
  });
  it('목록의 선택 카드만 표시하고 외부 복귀 주소를 받지 않는다',async()=>{
    const page=await CardDetailPage({params:Promise.resolve({cardId:'c2'}),searchParams:Promise.resolve({from:'https://example.com'})});
    render(page);
    expect(screen.getByRole('heading',{level:1,name:'heo_in_saeng'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'컬렉션으로'})).toHaveAttribute('href','/collection');
  });
});


it('선택한 등급의 장수만 상세에 표시한다',async()=>{
  render(await CardDetailPage({params:Promise.resolve({cardId:'c1'}),searchParams:Promise.resolve({grade:'basic'})}));
  expect(screen.getByText('보유 장수').parentElement).toHaveTextContent('3장');
});
