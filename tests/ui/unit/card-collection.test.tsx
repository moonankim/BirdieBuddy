import {fireEvent,render,screen,within} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {CardCollection} from '@/components/card/card-collection';
import {CardCatalog} from '@/components/card/card-catalog';
import {mockCollectionTemplates} from '@/app/(user)/_mock/cards';
import {initialCardFilters,selectOwned} from '@/lib/cards/collection';
import CollectionPage from '@/app/(user)/collection/page';
import CardDetailPage from '@/app/(user)/collection/[cardId]/page';

vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);},notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('@/components/chat/shell',()=>({Guard:({children}:{children:ReactNode})=><>{children}</>}));

const empty=mockCollectionTemplates.map(t=>({...t,counts:{basic:0,rare:0,legend:0}}));
const cdn='https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev';

describe('컬렉션(도감) — 정적 카드 목록',()=>{
  it('선수×등급 전체 카드를 실제 아트로 보여 주고 수집 현황을 계산한다',()=>{
    render(<CardCatalog/>);
    expect(screen.getAllByRole('article')).toHaveLength(36);
    expect(screen.getByRole('progressbar',{name:'카드 수집 현황'})).toHaveAttribute('value','4');
    expect(screen.getByRole('progressbar',{name:'카드 수집 현황'})).toHaveAttribute('max','36');
    expect(screen.getByText('선수 3 / 12명')).toBeInTheDocument();
    expect(screen.getByRole('img',{name:'공태풍 BASIC 카드'})).toHaveAttribute('src',`${cdn}/gtour-gong_tae_pung-basic.png`);
    expect(screen.getAllByRole('img',{name:/\(미보유\)$/})).toHaveLength(32);
    expect(screen.getAllByText('미보유')).toHaveLength(32);
    expect(screen.queryByText('아직 모은 카드가 없어요')).toBeNull();
  });
  it('등급·유형 칩으로 거르고 선택 상태를 aria-pressed로 알린다',()=>{
    render(<CardCatalog/>);
    const grade=screen.getByRole('group',{name:'등급'});
    fireEvent.click(within(grade).getByRole('button',{name:'RARE'}));
    expect(within(grade).getByRole('button',{name:'RARE'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getAllByRole('article')).toHaveLength(12);
    fireEvent.click(within(screen.getByRole('group',{name:'유형'})).getByRole('button',{name:'KLPGA'}));
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('link',{name:'hwang_yu_ja RARE 카드 상세 보기'})).toHaveAttribute('href','/collection/preview-klpga-hwang_yu_ja?grade=rare');
  });
  it('보유 현황 조회가 실패해도 카드 목록은 유지하고 보유 표시만 숨긴다',()=>{
    const retry=vi.fn();
    render(<CardCatalog ownership="error" onRetryOwnership={retry}/>);
    expect(screen.getAllByRole('article')).toHaveLength(36);
    expect(screen.queryByText('미보유')).toBeNull();
    expect(screen.queryAllByRole('img',{name:/\(미보유\)$/})).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('전체 미보유와 등록 카드 없음을 구분한다',()=>{
    const {rerender}=render(<CardCatalog templates={empty}/>);
    expect(screen.getByText('아직 모은 카드가 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'홈에서 라운드 완료하기'})).toHaveAttribute('href','/home');
    expect(screen.getAllByRole('article')).toHaveLength(36);
    rerender(<CardCatalog templates={[]}/>);
    expect(screen.getByText('등록된 카드가 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('보유 카드',()=>{
  it('등급별 양수만 표시하고 등급 높은 순을 기본으로 한다',()=>{
    render(<CardCollection/>);
    const rows=screen.getAllByRole('article');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('LEGEND');
    expect(screen.getByRole('region',{name:'보유 현황 (예시)'})).toHaveTextContent('17장');
    expect(screen.getByText('4종 보유')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'공태풍 BASIC 카드 상세 보기'})).toHaveAttribute('href','/collection/c1?grade=basic&from=owned');
    expect(screen.getByRole('link',{name:'heo_in_saeng BASIC 강화 미리보기'})).toHaveAttribute('href','/collection/upgrade?cardId=c2&grade=basic&from=owned');
  });
  it('칩 필터·선수 선택·정렬 토글을 조합하고 필터만 초기화한다',()=>{
    render(<CardCollection/>);
    fireEvent.click(screen.getByRole('button',{name:'장수순'}));
    expect(screen.getByRole('button',{name:'장수순'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('heo_in_saeng');
    fireEvent.change(screen.getByRole('combobox',{name:'선수'}),{target:{value:'c1'}});
    expect(screen.getAllByRole('article')).toHaveLength(2);
    fireEvent.click(within(screen.getByRole('group',{name:'유형'})).getByRole('button',{name:'G투어'}));
    fireEvent.click(within(screen.getByRole('group',{name:'등급'})).getByRole('button',{name:'LEGEND'}));
    expect(screen.getByText('조건에 맞는 카드가 없어요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'필터 초기화'}));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByRole('button',{name:'장수순'})).toHaveAttribute('aria-pressed','true');
  });
  it('선수 선택지는 보유한 선수만 제공한다',()=>{
    render(<CardCollection/>);
    expect(within(screen.getByRole('combobox',{name:'선수'})).getAllByRole('option')).toHaveLength(4);
  });
  it('보유 카드 없음·조회 실패·로딩을 구분한다',()=>{
    const {rerender}=render(<CardCollection templates={empty}/>);
    expect(screen.getByRole('heading',{name:'아직 보유한 카드가 없어요'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'홈에서 라운드 완료하기'})).toHaveAttribute('href','/home');
    expect(screen.queryByRole('group',{name:'등급'})).toBeNull();
    const retry=vi.fn();
    rerender(<CardCollection status="error" onRetry={retry}/>);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<CardCollection status="loading"/>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy','true');
  });
});

describe('목록 주소와 등급별 진입',()=>{
  it('기존 owned 탭 주소는 보유 카드 경로로 이동한다',async()=>{
    await expect(CollectionPage({searchParams:Promise.resolve({tab:'owned'})})).rejects.toThrow('REDIRECT:/collection/owned');
  });
  it('등급별 수량을 상세에서도 유지하고 미지원 등급을 변환하지 않는다',async()=>{
    render(await CardDetailPage({params:Promise.resolve({cardId:'c1'}),searchParams:Promise.resolve({grade:'rare',from:'owned'})}));
    expect(screen.getByText('보유 장수').parentElement).toHaveTextContent('2장');
    expect(screen.getByRole('link',{name:'보유 카드로'})).toHaveAttribute('href','/collection/owned');
    await expect(CardDetailPage({params:Promise.resolve({cardId:'c1'}),searchParams:Promise.resolve({grade:'epic'})})).rejects.toThrow('NOT_FOUND');
  });
  it('선수별 수량을 섞거나 0장 카드를 보유 목록에 만들지 않는다',()=>{
    const entries=selectOwned(mockCollectionTemplates,initialCardFilters);
    expect(entries.map(c=>[c.id,c.grade,c.count])).toEqual([['c3','legend',1],['c1','rare',2],['c1','basic',3],['c2','basic',11]]);
  });
});
