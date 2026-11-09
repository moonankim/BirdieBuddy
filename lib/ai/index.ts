// A-01 스텁: 실제 필터가 아니다. 위반 메시지도 통과하므로 구현으로 교체되기 전에 시연·배포에 쓰면 안 된다.
// 판정 분기 개발용으로 body에 [block] 또는 [suggest]를 넣으면 해당 판정을 돌려준다.

export type Verdict = 'pass' | 'suggest' | 'block';

export type ModerationResult = {
  verdict: Verdict;
  category?: string;
  flagged: { key: string; label: string; scope: '선택' | '항상 차단'; score: number }[];
  reason?: string;
  guide?: string | null;
  quality: number;
};

function warnStub(name: string) {
  console.warn(`[lib/ai] ${name}는 스텁입니다. 실제 판정이 아닙니다.`);
}

export async function moderateAndScore(input: {
  body: string;
  disabledFilters: string[];
}): Promise<ModerationResult> {
  warnStub('moderateAndScore');
  if (input.body.includes('[block]')) {
    return {
      verdict: 'block',
      category: 'threat',
      flagged: [{ key: 'threat', label: '협박', scope: '항상 차단', score: 1 }],
      reason: '스텁 차단 사유입니다.',
      guide: null,
      quality: 50,
    };
  }
  if (input.body.includes('[suggest]')) {
    return {
      verdict: 'suggest',
      category: 'profanity',
      flagged: [{ key: 'profanity', label: '욕설', scope: '선택', score: 1 }],
      reason: '스텁 수정 제안 사유입니다.',
      guide: '스텁 안내 문구입니다.',
      quality: 50,
    };
  }
  return { verdict: 'pass', flagged: [], quality: 50 };
}

export async function suggestRewrite(
  body: string,
  flagged: string[],
  disabledFilters: string[],
): Promise<string | null> {
  warnStub('suggestRewrite');
  return `(스텁 수정 문장) ${body}`;
}

export async function clusterQuestion(roomId: string, body: string): Promise<string | null> {
  throw new Error('not implemented: clusterQuestion (A-04)');
}

export async function summarize(messages: { body: string; sender: string }[]): Promise<string> {
  throw new Error('not implemented: summarize (A-05)');
}
