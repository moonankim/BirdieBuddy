import {fireEvent,render,screen} from '@testing-library/react';
import {act} from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {CardUpgrade} from '@/components/card/card-upgrade';
import type {CardPreview} from '@/lib/cards/presentation';
import CardUpgradePage from '@/app/(user)/collection/upgrade/page';

vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('CARD_NOT_FOUND');}}));
vi.mock('@/components/chat/shell',()=>({Guard:({children}:{children:ReactNode})=><>{children}</>}));
const card:CardPreview={id:'preview',name:'예시 선수',category:'gtour',grade:'basic',count:11,verifiedAt:null};
function startUpgrade(){
  fireEvent.click(screen.getByRole('checkbox',{name:'사용·획득·잔여 수량을 확인했어요'}));
  fireEvent.click(screen.getByRole('button',{name:'강화 결과 미리보기'}));
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('카드 강화 UI 목업',()=>{
  it('공통 디폴트 이미지 두 장과 확인 전 비활성 버튼을 표시한다',()=>{
    const {container}=render(<CardUpgrade card={card}/>);
    expect(screen.getByRole('img',{name:'예시 선수 현재 등급 카드'})).toHaveAttribute('src','https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/default-card-at.png');
    expect(screen.getByRole('img',{name:'예시 선수 다음 등급 카드'})).toHaveAttribute('src','https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/default-card-at.png');
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.getByRole('button',{name:'강화 결과 미리보기'})).toBeDisabled();
    expect(screen.getByText('목업 미리보기')).toBeInTheDocument();
  });
  it.each([10,11])('%i장 확인 후 다음 등급 1장과 정확한 잔여를 보여 주고 원본을 변경하지 않는다',(count)=>{
    const source={...card,count};
    const {unmount}=render(<CardUpgrade card={source} returnToOwned/>);
    startUpgrade();
    expect(screen.getByRole('heading',{level:1,name:'카드 강화 중'})).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('BASIC 카드 10장을 모아 RARE 카드를 만들고 있어요.');
    fireEvent.click(screen.getByRole('button',{name:'연출 건너뛰기'}));
    expect(screen.getByRole('heading',{level:1,name:'강화 결과 미리보기'})).toHaveFocus();
    expect(screen.getByText('받은 RARE 카드').parentElement).toHaveTextContent('1장');
    expect(screen.getByText('남은 BASIC 카드').parentElement).toHaveTextContent(`${count-10}장`);
    expect(screen.queryByRole('button',{name:'강화 결과 미리보기'})).toBeNull();
    expect(screen.getByRole('link',{name:'보유 카드로'})).toHaveAttribute('href','/collection/owned');
    expect(screen.getByRole('link',{name:'RARE 카드 보기'})).toHaveAttribute('href','/collection/preview?grade=rare&from=owned');
    expect(source.count).toBe(count);
    unmount();
    render(<CardUpgrade card={source}/>);
    expect(screen.getByRole('heading',{level:1,name:'카드 강화'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'강화 결과 미리보기'})).toBeDisabled();
  });
  it('RARE에서는 LEGEND 결과를 표시한다',()=>{
    render(<CardUpgrade card={{...card,grade:'rare'}}/>);
    startUpgrade();
    fireEvent.click(screen.getByRole('button',{name:'연출 건너뛰기'}));
    expect(screen.getByText('받은 LEGEND 카드').parentElement).toHaveTextContent('1장');
  });
  it.each([['basic',3000],['rare',5000]] as const)('%s 강화 연출은 %ims 뒤 자동으로 결과를 공개한다',(grade,ms)=>{
    vi.useFakeTimers();
    render(<CardUpgrade card={{...card,grade}}/>);
    startUpgrade();
    act(()=>{vi.advanceTimersByTime(ms-1);});
    expect(screen.getByRole('heading',{level:1,name:'카드 강화 중'})).toBeInTheDocument();
    act(()=>{vi.advanceTimersByTime(1);});
    expect(screen.getByRole('heading',{level:1,name:'강화 결과 미리보기'})).toHaveFocus();
  });
  it('연출 중 화면을 떠나면 타이머를 정리한다',()=>{
    vi.useFakeTimers();
    const {unmount}=render(<CardUpgrade card={card}/>);
    fireEvent.click(screen.getByRole('checkbox'));
    const before=vi.getTimerCount();
    fireEvent.click(screen.getByRole('button',{name:'강화 결과 미리보기'}));
    expect(vi.getTimerCount()).toBe(before+1);
    unmount();
    act(()=>{vi.runAllTimers();});
    expect(screen.queryByRole('heading',{name:'강화 결과 미리보기'})).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('동작 줄이기 설정에서는 연출 없이 바로 결과를 보여 준다',()=>{
    vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('reduce'),media:query,addEventListener(){},removeEventListener(){}}));
    render(<CardUpgrade card={card}/>);
    startUpgrade();
    expect(screen.queryByRole('button',{name:'연출 건너뛰기'})).toBeNull();
    expect(screen.getByRole('heading',{level:1,name:'강화 결과 미리보기'})).toHaveFocus();
  });
  it('다음 등급의 기존 수량을 확인·결과에 반영해 보여 준다',()=>{
    render(<CardUpgrade card={card} nextCount={2}/>);
    expect(screen.getByText('보유 RARE 카드').parentElement).toHaveTextContent('2장');
    startUpgrade();
    fireEvent.click(screen.getByRole('button',{name:'연출 건너뛰기'}));
    expect(screen.getByText('보유 RARE 카드').parentElement).toHaveTextContent('2장 → 3장');
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
    expect(screen.queryByRole('img',{name:'예시 선수 다음 등급 카드'})).toBeNull();
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
    expect(screen.getByText('보유 RARE 카드').parentElement).toHaveTextContent('0장');
  });
});
