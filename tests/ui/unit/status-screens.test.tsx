import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotFound from '@/app/not-found';
import RouteError from '@/app/error';
import { Spinner } from '@/components/ui';

// D-1 공통 상태 화면(design-system sample/states.html).
describe('shared loading, error and 404 screens', () => {
  it('announces loading with visible text next to the spinner', () => {
    render(<Spinner label="카드를 불러오는 중..." />);
    expect(screen.getByRole('status')).toHaveTextContent('카드를 불러오는 중...');
  });

  it('shows a 404 page with a way home', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeVisible();
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
  });

  it('shows the route error page and retries by resetting the boundary', () => {
    const reset = vi.fn();
    render(<RouteError error={new Error('boom')} reset={reset} />);
    expect(screen.getByRole('alert')).toHaveTextContent('인터넷 연결을 확인한 후 다시 시도해 주세요.');
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
