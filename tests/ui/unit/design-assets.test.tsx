import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {CardArtwork,StatusPanel} from '@/components/ui/card-artwork';

describe('공통 카드와 상태 구성요소',()=>{
  it('이미지 로드 실패 시 자리표시자로 전환하고 새 URL은 다시 표시한다',()=>{
    const {rerender}=render(<CardArtwork name="서윤" src="https://example.com/one.webp" grade="rare"/>);
    fireEvent.error(screen.getByRole('img',{name:'서윤 카드'}));
    expect(screen.getByRole('img',{name:'서윤 카드 이미지 준비 중'})).toBeTruthy();
    expect(screen.getByText('레어')).toBeTruthy();
    rerender(<CardArtwork name="서윤" src="https://example.com/two.webp"/>);
    expect(screen.getByRole('img',{name:'서윤 카드'})).toBeTruthy();
  });
  it('미보유 카드는 이미지 URL이 있어도 아트를 노출하지 않는다',()=>{
    render(<CardArtwork name="서윤" src="https://example.com/one.webp" unowned/>);
    expect(screen.getByRole('img',{name:'미보유 카드'})).toBeTruthy();
    expect(screen.queryByRole('img',{name:'서윤 카드'})).toBeNull();
  });
  it('재시도 동작을 전달하고 처리 중에는 중복 실행을 막는다',()=>{
    const retry=vi.fn();
    const {rerender}=render(<StatusPanel tone="error" title="조회 실패" onRetry={retry}>연결을 확인해 주세요.</StatusPanel>);
    fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<StatusPanel tone="loading" title="조회 중" onRetry={retry}/>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
  });
});
