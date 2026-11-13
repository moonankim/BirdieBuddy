import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorText } from '@/components/chat/copy';
import { Avatar } from '@/components/ui/avatar';

describe('safe user-facing errors', () => {
  it('uses server admission detail numbers instead of guessing card or round requirements', () => {
    expect(errorText('INSUFFICIENT_CARDS', { missingCards: 2 })).toContain('2장');
    expect(errorText('REJOIN_NOT_AVAILABLE', { monthlyRoundCount: 1 })).toContain('이번 달 1회');
    expect(errorText('RATE_LIMITED', { retryAfterSeconds: 17 })).toContain('17초');
  });
  it.each([
    ['UNAUTHENTICATED', '다시 로그인해 주세요.'],
    ['FORBIDDEN', '이 화면을 사용할 권한이 없어요.'],
    ['ROOM_INACTIVE', '채팅방에서 퇴장한 상태예요.'],
    ['FILTERS_CHANGED', '채팅방 필터 설정이 바뀌었어요. 다시 보내 주세요.'],
    ['NETWORK_ERROR', '연결이 불안정해요. 다시 시도해 주세요.'],
  ])('maps %s to its recovery guidance', (code, text) => {
    expect(errorText(code)).toBe(text);
  });
  it('keeps unknown diagnostics out of the displayed fallback', () => {
    const result = errorText('raw SQL traceback / JWT diagnostic');
    expect(result).toBe('문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    expect(result).not.toContain('JWT');
    expect(errorText('INSUFFICIENT_CARDS', { missingCards: 'untrusted markup' })).not.toContain('untrusted');
  });
});

describe('Avatar fallback and replacement', () => {
  it('uses the default profile image when there is no photo, and the first character only if that also fails', () => {
    const { container } = render(<Avatar src={null} name="🏌️ 버디" />);
    const fallback = container.querySelector('img');
    expect(fallback).toHaveAttribute('src', '/assets/avatar-default.svg');
    expect(fallback).toHaveAttribute('alt', '');
    if (!fallback) throw new Error('Expected default profile image');
    fireEvent.error(fallback);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByLabelText('🏌️ 버디')).toHaveTextContent('🏌');
  });
  it('falls back to the default image on error and tries a different URL after a profile change', () => {
    const { container, rerender } = render(<Avatar src="/old.webp" name="버디" />);
    const old = container.querySelector('img');
    expect(old).toHaveAttribute('src', '/old.webp');
    if (!old) throw new Error('Expected profile image');
    fireEvent.error(old);
    expect(container.querySelector('img')).toHaveAttribute('src', '/assets/avatar-default.svg');
    rerender(<Avatar src="/new.webp" name="버디" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/new.webp');
  });
});
