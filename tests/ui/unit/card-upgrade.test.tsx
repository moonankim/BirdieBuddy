import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {CardUpgrade} from '@/components/card/card-upgrade';
import type {CardPreview} from '@/lib/cards/presentation';
import CardUpgradePage from '@/app/(user)/collection/upgrade/page';

vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('CARD_NOT_FOUND');}}));
vi.mock('@/components/chat/shell',()=>({Guard:({children}:{children:ReactNode})=><>{children}</>}));
const card:CardPreview={id:'preview',name:'예시 선수',category:'gtour',grade:'basic',count:11,verifiedAt:null};

describe('카드 강화 UI 목업',()=>{
  it('외부 이미지 없이 두 디폴트 카드와 확인 전 비활성 버튼을 표시한다',()=>{
    const {container}=render(<CardUpgrade card={card}/>);
    expect(screen.getByRole('img',{name:'예시 선수 현재 등급 카드 이미지 준비 중'})).toBeInTheDocument();
    expect(screen.getByRole('img',{name:'예시 선수 다음 등급 카드 이미지 준비 중'})).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button',{name:'강화 결과 미리보기'})).toBeDisabled();
    expect(screen.getByText('목업 미리보기')).toBeInTheDocument();
  });
  it.each([10,11])('%i장 확인 후 다음 등급 1장과 정확한 잔여를 보여 주고 원본을 변경하지 않는다',(count)=>{
    const source={...card,count};
    const {unmount}=render(<CardUpgrade card={source} returnToOwned/>);
    fireEvent.click(screen.getByRole('checkbox',{name:'사용·획득·잔여 수량을 확인했어요'}));
    fireEvent.click(screen.getByRole('button',{name:'강화 결과 미리보기'}));
    expect(screen.getByRole('heading',{level:1,name:'강화 결과 미리보기'})).toHaveFocus();
    expect(screen.getByText('받은 RARE 카드').parentElement).toHaveTextContent('1장');
    expect(screen.getByText('남은 BASIC 카드').parentElement).toHaveTextContent(`${count-10}장`);
    expect(screen.queryByRole('button',{name:'강화 결과 미리보기'})).toBeNull();
    expect(screen.getByRole('link',{name:'컬렉션으로'})).toHaveAttribute('href','/collection/owned');
    expect(source.count).toBe(count);
    unmount();
    render(<CardUpgrade card={source}/>);
    expect(screen.getByRole('heading',{level:1,name:'카드 강화'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'강화 결과 미리보기'})).toBeDisabled();
  });
  it('RARE에서는 LEGEND 결과를 표시한다',()=>{
    render(<CardUpgrade card={{...card,grade:'rare'}}/>);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button',{name:'강화 결과 미리보기'}));
    expect(screen.getByText('받은 LEGEND 카드').parentElement).toHaveTextContent('1장');
  });
  it.each([[0,'10장 더 필요해요'],[9,'1장 더 필요해요']])('부족 수량 %i장에서는 결과로 넘어가지 않는다',(count,label)=>{
    render(<CardUpgrade card={{...card,count}}/>);
    const button=screen.getByRole('button',{name:label});
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('heading',{level:1,name:'카드 강화'})).toBeInTheDocument();
    expect(screen.getByText('강화 후 기존 등급 잔여').parentElement).toHaveTextContent('강화 불가');
  });
  it('최고 등급으로 직접 진입해도 강화가 차단된다',()=>{
    render(<CardUpgrade card={{...card,grade:'legend'}}/>);
    expect(screen.getByRole('button',{name:'최고 등급 카드'})).toBeDisabled();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('img',{name:'예시 선수 다음 등급 카드 이미지 준비 중'})).toBeNull();
  });
});

describe('강화 페이지의 직접 주소',()=>{
  it.each([undefined,'missing',['c2','c3']])('유효하지 않은 카드 선택을 임의로 대체하지 않는다',async cardId=>{
    await expect(CardUpgradePage({searchParams:Promise.resolve({cardId})})).rejects.toThrow('CARD_NOT_FOUND');
  });
  it('충분한 카드 선택과 보유 탭 복귀를 유지한다',async()=>{
    render(await CardUpgradePage({searchParams:Promise.resolve({cardId:'c2',from:'owned'})}));
    expect(screen.getByRole('link',{name:'카드 상세로'})).toHaveAttribute('href','/collection/c2?grade=basic&from=owned');
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
