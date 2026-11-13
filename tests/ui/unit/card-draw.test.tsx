import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {CardDrawReveal} from '@/components/card/card-draw-reveal';
import {mockDrawResult} from '@/app/(user)/_mock/draw';
import {drawRevealTiming} from '@/lib/cards/presentation';
import DrawPreviewPage from '@/app/(user)/draw/preview/page';

vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('@/components/chat/shell',()=>({Guard:({children}:{children:ReactNode})=><>{children}</>}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

const stage=()=>screen.getByRole('region',{name:'카드 공개'});
const advance=(ms:number)=>act(()=>{vi.advanceTimersByTime(ms);});
const heartbeatMs=(grade:'basic'|'rare'|'legend')=>drawRevealTiming.beats[grade]*drawRevealTiming.beatMs;

describe('두근두근 뽑기 연출',()=>{
  it.each(['basic','rare','legend'] as const)('%s는 등급별 박동 시간 뒤에야 카드를 열 수 있다',grade=>{
    vi.useFakeTimers();
    render(<CardDrawReveal result={mockDrawResult({grade})!}/>);
    expect(stage()).toHaveAttribute('data-phase','intro');
    expect(stage()).toHaveAttribute('data-grade',grade);
    advance(drawRevealTiming.introMs);
    expect(stage()).toHaveAttribute('data-phase','heartbeat');
    fireEvent.click(screen.getByRole('button',{name:'카드 준비 중'}));
    expect(stage()).toHaveAttribute('data-phase','heartbeat');
    advance(heartbeatMs(grade)-1);
    expect(stage()).toHaveAttribute('data-phase','heartbeat');
    advance(1);
    expect(stage()).toHaveAttribute('data-phase','ready');
    expect(screen.getByRole('status')).toHaveTextContent('카드를 눌러 열어 보세요');
  });
  it('탭하면 뒤집혀 공개되고 결과 제목으로 포커스가 이동한다',()=>{
    vi.useFakeTimers();
    render(<CardDrawReveal result={mockDrawResult({grade:'legend'})!}/>);
    advance(drawRevealTiming.introMs);
    advance(heartbeatMs('legend'));
    fireEvent.click(screen.getByRole('button',{name:'카드 열기'}));
    expect(stage()).toHaveAttribute('data-phase','flip');
    expect(screen.getByRole('img',{name:'김홍차 LEGEND 카드'})).toHaveAttribute('src','https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-kim_hong_cha-legend.png');
    advance(drawRevealTiming.flipMs);
    expect(screen.getByRole('heading',{level:1,name:'김홍차'})).toHaveFocus();
    expect(screen.getByText('LEGEND 카드가 도착했어요 · 이 등급 1장 보유 (예시)')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });
  it('탭하지 않아도 일정 시간 뒤 자동으로 공개된다',()=>{
    vi.useFakeTimers();
    render(<CardDrawReveal result={mockDrawResult({grade:'basic'})!}/>);
    advance(drawRevealTiming.introMs);
    advance(heartbeatMs('basic'));
    advance(drawRevealTiming.autoRevealMs);
    expect(stage()).toHaveAttribute('data-phase','flip');
    advance(drawRevealTiming.flipMs);
    expect(stage()).toHaveAttribute('data-phase','result');
  });
  it('건너뛰기는 연출 중 언제든 결과를 보여 준다',()=>{
    vi.useFakeTimers();
    render(<CardDrawReveal result={mockDrawResult({grade:'rare'})!}/>);
    advance(drawRevealTiming.introMs);
    fireEvent.click(screen.getByRole('button',{name:'건너뛰기'}));
    expect(stage()).toHaveAttribute('data-phase','result');
    expect(screen.queryByRole('button',{name:'건너뛰기'})).toBeNull();
    expect(screen.getByRole('heading',{level:1,name:'김홍차'})).toHaveFocus();
  });
  it('동작 줄이기 설정에서는 연출 없이 결과만 보여 준다',()=>{
    vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('reduce'),media:query,addEventListener(){},removeEventListener(){}}));
    render(<CardDrawReveal result={mockDrawResult({grade:'legend'})!}/>);
    expect(stage()).toHaveAttribute('data-phase','result');
    expect(screen.queryByRole('button',{name:'건너뛰기'})).toBeNull();
  });
  it('화면을 떠나면 연출 타이머를 정리한다',()=>{
    vi.useFakeTimers();
    const {unmount}=render(<CardDrawReveal result={mockDrawResult({grade:'legend'})!}/>);
    advance(drawRevealTiming.introMs);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('중복 카드는 +1장, 입장 가능하면 채팅 안내를 보여 준다',()=>{
    vi.useFakeTimers();
    render(<CardDrawReveal result={mockDrawResult({grade:'basic',isNew:false,entryUnlocked:true})!}/>);
    fireEvent.click(screen.getByRole('button',{name:'건너뛰기'}));
    expect(screen.getByText('+1장')).toBeInTheDocument();
    expect(screen.queryByText('NEW')).toBeNull();
    expect(screen.getByRole('link',{name:'채팅방 보기'})).toHaveAttribute('href','/chat');
    expect(screen.getByRole('link',{name:'컬렉션 보기'})).toHaveAttribute('href','/collection');
  });
});

describe('뽑기 연출 미리보기 주소',()=>{
  it('등급 파라미터로 시나리오를 고르고 잘못된 등급은 대체하지 않는다',async()=>{
    render(await DrawPreviewPage({searchParams:Promise.resolve({grade:'rare'})}));
    expect(screen.getByRole('region',{name:'카드 공개'})).toHaveAttribute('data-grade','rare');
    expect(screen.getByRole('link',{name:'RARE'})).toHaveAttribute('aria-current','page');
    await expect(DrawPreviewPage({searchParams:Promise.resolve({grade:'epic'})})).rejects.toThrow('NOT_FOUND');
  });
});
