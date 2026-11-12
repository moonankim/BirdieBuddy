import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Result } from '@/lib/api/types';
import { useRequest } from '@/components/chat/hooks/use-request';

type Input = { roomId: string; body: string };
type Request = Input & { requestId: string };
const input: Input = { roomId: 'room-1', body: '질문입니다' };
const success: Result<string> = { ok: true, data: 'stored-message' };
const failure = (code: string, retryable = true): Result<string> => ({
  ok: false,
  error: { code, message: 'raw SDK diagnostic', retryable },
});

describe('useRequest request identity', () => {
  it('creates distinct UUIDs for separate user actions', async () => {
    const call = vi.fn<(request: Request) => Promise<Result<string>>>().mockResolvedValue(success);
    const { result } = renderHook(() => useRequest<Input, string>(call));

    await act(async () => { await result.current.run(input); });
    await act(async () => { await result.current.run(input); });

    const ids = call.mock.calls.map(([request]) => request.requestId);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it.each(['NETWORK_ERROR', 'REQUEST_IN_PROGRESS', 'FILTERS_CHANGED', 'FILTER_UNAVAILABLE', 'SOURCE_CHANGED'])(
    'retries %s with the original requestId and payload, then clears the saved request',
    async (code) => {
      const call = vi.fn<(request: Request) => Promise<Result<string>>>()
        .mockResolvedValueOnce(failure(code)).mockResolvedValueOnce(success);
      const { result } = renderHook(() => useRequest<Input, string>(call));

      await act(async () => { await result.current.run(input); });
      expect(result.current.error?.code).toBe(code);
      expect(result.current.pending).toBe(false);
      await act(async () => { await result.current.retry(); });

      expect(call.mock.calls[1][0]).toEqual(call.mock.calls[0][0]);
      expect(result.current.error).toBeNull();
      await act(async () => { await result.current.retry(); });
      expect(call).toHaveBeenCalledTimes(2);
    },
  );

  it('maps a thrown transport error to a retryable error without losing request identity', async () => {
    const call = vi.fn<(request: Request) => Promise<Result<string>>>()
      .mockRejectedValueOnce(new TypeError('connection lost')).mockResolvedValueOnce(success);
    const { result } = renderHook(() => useRequest<Input, string>(call));

    await act(async () => { await result.current.run(input); });
    expect(result.current.error).toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    await act(async () => { await result.current.retry(); });
    expect(call.mock.calls[1][0]).toEqual(call.mock.calls[0][0]);
  });

  it('clears a terminal failure so retry cannot submit it again', async () => {
    const call = vi.fn<(request: Request) => Promise<Result<string>>>()
      .mockResolvedValue(failure('VALIDATION_ERROR', false));
    const { result } = renderHook(() => useRequest<Input, string>(call));

    await act(async () => { await result.current.run(input); });
    await act(async () => { await result.current.retry(); });
    expect(call).toHaveBeenCalledTimes(1);
    expect(result.current.error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects concurrent clicks without replacing the original pending request used by retry', async () => {
    let finish!: (value: Result<string>) => void;
    const call = vi.fn<(request: Request) => Promise<Result<string>>>()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(success);
    const { result } = renderHook(() => useRequest<Input, string>(call));
    let pending!: Promise<Result<string>>;

    act(() => { pending = result.current.run(input); });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      const duplicate = await result.current.run({ ...input, body: '다른 질문' });
      expect(duplicate).toMatchObject({ ok: false, error: { code: 'REQUEST_IN_PROGRESS' } });
    });
    expect(call).toHaveBeenCalledTimes(1);
    await act(async () => { finish(failure('NETWORK_ERROR')); await pending; });
    await act(async () => { await result.current.retry(); });

    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1][0]).toEqual(call.mock.calls[0][0]);
  });

  it('preserves the same File object on upload retry', async () => {
    const file = new File(['photo'], 'photo.webp', { type: 'image/webp' });
    const call = vi.fn<(request: { file: File; requestId: string }) => Promise<Result<string>>>()
      .mockResolvedValueOnce(failure('NETWORK_ERROR')).mockResolvedValueOnce(success);
    const { result } = renderHook(() => useRequest<{ file: File }, string>(call));
    await act(async () => { await result.current.run({ file }); });
    await act(async () => { await result.current.retry(); });

    expect(call.mock.calls[1][0].file).toBe(file);
    expect(call.mock.calls[1][0].requestId).toBe(call.mock.calls[0][0].requestId);
  });

  it('does not retry automatically and reset discards the pending retry', async () => {
    const call = vi.fn<(request: Request) => Promise<Result<string>>>()
      .mockResolvedValue(failure('NETWORK_ERROR'));
    const { result } = renderHook(() => useRequest<Input, string>(call));
    await act(async () => { await result.current.run(input); });
    expect(call).toHaveBeenCalledTimes(1);
    act(() => { result.current.reset(); });
    expect(result.current.error).toBeNull();
    await act(async () => { await result.current.retry(); });
    expect(call).toHaveBeenCalledTimes(1);
  });
});
