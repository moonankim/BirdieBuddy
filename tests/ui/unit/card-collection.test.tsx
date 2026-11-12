import {fireEvent,render,screen,within} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {CardCollection} from '@/components/card/card-collection';
import {mockCollectionTemplates} from '@/app/(user)/_mock/cards';
import {initialCardFilters,selectOwned} from '@/lib/cards/collection';
import CollectionPage from '@/app/(user)/collection/page';
import CardDetailPage from '@/app/(user)/collection/[cardId]/page';

vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);},notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('@/components/chat/shell',()=>({Guard:({children}:{children:ReactNode})=><>{children}</>}));

describe('기획 기준의 카드 목록 목업',()=>{
  it('전체 12명과 실제 이름별 미보유를 표시하고 수집 현황은 데이터로 계산한다',()=>{
    const {container}=render(<CardCollection/>);
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getAllByText('미보유')).toHaveLength(9);
    expect(screen.queryByRole('heading',{name:'미보유 카드'})).toBeNull();
    expect(screen.getByRole('progressbar',{name:'예시 카드 수집 현황'})).toHaveAttribute('value','3');
    expect(screen.getByRole('progressbar')).toHaveAttribute('max','12');
    expect(screen.getByText('화면 확인용 예시')).toBeInTheDocument();
    // 보유 카드만 공통 CDN 디폴트 이미지를 사용하고 미보유는 실루엣을 유지한다.
    const images=[...container.querySelectorAll('img')];
    expect(images).toHaveLength(3);
    images.forEach(img=>expect(img).toHaveAttribute('src','https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/default-card-at.png'));
    expect(screen.queryByText('아직 모은 카드가 없어요')).toBeNull();
  });
  it('미보유만 있어도 수집 현황을 배열 길이로 세지 않는다',()=>{
    render(<CardCollection templates={mockCollectionTemplates.map(t=>({...t,counts:{basic:0,rare:0,legend:0}}))}/>);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value','0');
    expect(screen.getByText('아직 모은 카드가 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'라운드 완료'})).toHaveAttribute('href','/draw');
    expect(screen.getAllByRole('article')).toHaveLength(12);
  });
  it('동일 선수의 등급별 수량과 상세 경로를 보존한다',()=>{
    render(<CardCollection/>);
    expect(screen.getByRole('link',{name:'공태풍 BASIC 3장 상세 보기'})).toHaveAttribute('href','/collection/c1?grade=basic');
    expect(screen.getByRole('link',{name:'공태풍 RARE 2장 상세 보기'})).toHaveAttribute('href','/collection/c1?grade=rare');
    expect(screen.getByRole('link',{name:'heo_in_saeng BASIC 강화 미리보기'})).toHaveAttribute('href','/collection/upgrade?cardId=c2&grade=basic');
  });
  it('보유 목록은 등급별 양수만 표시하고 등급 높은 순을 기본으로 한다',()=>{
    render(<CardCollection owned/>);
    const rows=screen.getAllByRole('article');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('LEGEND');
    expect(screen.getByText('17장')).toBeInTheDocument();
    expect(screen.queryByText('미보유')).toBeNull();
    expect(screen.getByRole('link',{name:'공태풍 BASIC 카드 상세 보기'})).toHaveAttribute('href','/collection/c1?grade=basic&from=owned');
    expect(screen.getByRole('link',{name:'공태풍 RARE 카드 상세 보기'})).toBeInTheDocument();
  });
  it('선수·유형·등급 필터와 장수 정렬을 조합하고 초기화한다',()=>{
    render(<CardCollection owned/>);
    fireEvent.change(screen.getByRole('combobox',{name:'정렬'}),{target:{value:'count'}});
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('heo_in_saeng');
    fireEvent.change(screen.getByRole('combobox',{name:'선수'}),{target:{value:'c1'}});
    expect(screen.getAllByRole('article')).toHaveLength(2);
    fireEvent.change(screen.getByRole('combobox',{name:'유형'}),{target:{value:'gtour'}});
    fireEvent.change(screen.getByRole('combobox',{name:'등급'}),{target:{value:'legend'}});
    expect(screen.getByText('조건에 맞는 카드가 없어요')).toBeInTheDocument();
    const reset=screen.getAllByRole('button',{name:'필터 초기화'});
    fireEvent.click(reset[0]);
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });
  it('컬렉션의 등급 선택은 미보유를 숨기지 않고 해당 등급 상세를 선택한다',()=>{
    render(<CardCollection/>);
    fireEvent.change(screen.getByRole('combobox',{name:'등급'}),{target:{value:'basic'}});
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getByRole('link',{name:'공태풍 BASIC 카드 상세 보기'})).toBeInTheDocument();
    const category=screen.getByRole('combobox',{name:'유형'});
    expect(within(category).getAllByRole('option')).toHaveLength(5);
    fireEvent.change(category,{target:{value:'klpga'}});
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });
  it('보유 카드 없음·등록 카드 없음·조회 실패·로딩을 구분한다',()=>{
    const empty=mockCollectionTemplates.map(t=>({...t,counts:{basic:0,rare:0,legend:0}}));
    const {rerender}=render(<CardCollection owned templates={empty}/>);
    expect(screen.getByRole('heading',{name:'아직 보유한 카드가 없어요'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'라운드 완료'})).toHaveAttribute('href','/draw');
    rerender(<CardCollection templates={[]}/>);
    expect(screen.getByText('등록된 카드가 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    const retry=vi.fn();
    rerender(<CardCollection status="error" onRetry={retry}/>);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<CardCollection status="loading"/>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy','true');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('목록 주소와 등급별 진입',()=>{
  it('기존 owned 탭 주소는 아키텍처의 보유 카드 경로로 이동한다',async()=>{
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
